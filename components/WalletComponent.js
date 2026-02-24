import React, { useEffect, useMemo, useRef, useState } from "react";
import MyAssets from "./wallet/MyAssets";
import MyCoins from "./wallet/MyCoins";
import Portfolio from "./wallet/Portfolio";
import Favorites from "./wallet/Favorites";

import {
    getTotalAssets,
    getTotalEvalAmount,
    getTotalProfit,
    getTotalProfitRate,
    getPortfolioAsset,
    getCoinEvalAmount,
    getCoinProfit,
} from "../api/assetPriceStream";

import { upsertCashBalance, getCashBalance } from "../api/krwAsset";

import {
    getAllCoinAssets,
    createCoinAsset,
    updateCoinAsset,
    deleteCoinAsset,
    getTotalCoinBuyAmount,
} from "../api/coinAsset";

import { getFavoriteCoins, addFavoriteCoin, deleteFavoriteCoin, deleteAllFavoriteCoins } from "../api/favoriteCoin";
import { getAllMarkets } from "../api/tradingPair";
import { getStoredToken } from "../api/member";

import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

/**
 * WalletComponent - Wallet 전체(보유자산 / 보유코인 / 포트폴리오 / 관심코인)
 * 관심코인 탭은 별도 Favorites 컴포넌트로 분리하여 사용합니다.
 *
 * 변경 요약:
 * - Favorites 컴포넌트에 부모의 선택 삭제 핸들러를 onDeleteSelected로 전달하도록 수정
 * - 부모에서 선택 삭제 확인(confirm)은 제거 (자식에서 confirm 처리)
 */

export default function WalletComponent() {
    const [activeTab, setActiveTab] = useState("myAssets");

    const [summary, setSummary] = useState({
        totalAsset: 0,
        totalEval: 0,
        totalProfit: 0,
        profitRate: "0.00",
        cashBalance: 0,
        totalBuyAmount: 0,
    });

    const [assets, setAssets] = useState([]);
    const [rawCoinAssets, setRawCoinAssets] = useState([]);
    const [portfolio, setPortfolio] = useState([]);
    const [loading, setLoading] = useState(true);
    const [markets, setMarkets] = useState([]);
    const [favorites, setFavorites] = useState([]);

    const [krwInput, setKrwInput] = useState("");

    const [coinInput, setCoinInput] = useState("");
    const [coinBalanceInput, setCoinBalanceInput] = useState("");
    const [coinAvgPriceInput, setCoinAvgPriceInput] = useState("");

    const [selectedMarket, setSelectedMarket] = useState(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editCoinBalance, setEditCoinBalance] = useState("");
    const [editAvgBuyPrice, setEditAvgBuyPrice] = useState("");

    const [coinFilter, setCoinFilter] = useState("");

    // favorites UI state (keep favInput if you want to reuse later)
    const [favInput, setFavInput] = useState("");

    // STOMP / tickers
    const [tickers, setTickers] = useState({});
    const pendingTickersRef = useRef({});
    const stompClientRef = useRef(null);

    const [token, setTokenState] = useState(() => (typeof window !== "undefined" ? getStoredToken(localStorage.getItem("token")) : null));

    useEffect(() => {
        const update = () => setTokenState(getStoredToken(localStorage.getItem("token")));
        update();
        const onStorage = (e) => {
            if (e.key === "token") update();
        };
        window.addEventListener && window.addEventListener("storage", onStorage);
        return () => {
            window.removeEventListener && window.removeEventListener("storage", onStorage);
        };
    }, []);

    useEffect(() => {
        if (!token) return;
        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    // --------- Helpers ----------
    const normalizeMarket = (m) => {
        if (!m && m !== 0) return "";
        let s = String(m).trim().toUpperCase();
        s = s.replace(/\s+/g, "");
        if (s.includes("-")) return s;
        const match = s.match(/^([A-Z]{3})([A-Z0-9]+)$/);
        if (match) return `${match[1]}-${match[2]}`;
        return s;
    };

    const extractMarket = (c) => {
        if (!c) return "";
        if (typeof c.market === "string" && c.market.trim()) return c.market.trim();

        const tp = c.tradingPair ?? c.trading_pair;
        if (tp && typeof tp === "object") {
            const candidates = [tp.market, tp.symbol, tp.name, tp.english_name, tp.korean_name];
            for (const x of candidates) {
                if (typeof x === "string" && x.trim()) return x.trim();
            }
        }

        if (typeof tp === "string" && tp.trim()) return tp.trim();
        if (typeof tp === "number") return String(tp);

        const alt = c.market_name ?? c.marketString ?? c.symbol ?? c.coinSymbol;
        if (typeof alt === "string" && alt.trim()) return alt.trim();

        return "";
    };

    const extractSymbol = (c, marketStr) => {
        if (typeof marketStr === "string" && marketStr.includes("-")) {
            return marketStr.split("-")[1];
        }
        const tp = c?.tradingPair ?? c?.trading_pair;
        if (tp && typeof tp === "object") {
            return tp.symbol ?? tp.english_name ?? tp.korean_name ?? tp.name ?? "";
        }
        if (typeof c.coinSymbol === "string" && c.coinSymbol.trim()) return c.coinSymbol.trim();
        if (typeof c.symbol === "string" && c.symbol.trim()) return c.symbol.trim();
        return typeof marketStr === "string" && marketStr ? marketStr : "";
    };

    const calcBuyAmount = (coinBalance, avgBuyPrice) => {
        return Math.round((Number(coinBalance) || 0) * (Number(avgBuyPrice) || 0));
    };

    // --------- STOMP / SockJS 연결 ----------
    useEffect(() => {
        if (!token) return;

        const backendWsUrl = process.env.REACT_APP_BACKEND_WS_URL || "http://localhost:8080/ws";

        try {
            stompClientRef.current?.deactivate();
        } catch (e) {
            /* ignore */
        }

        const client = new Client({
            webSocketFactory: () => new SockJS(backendWsUrl),
            reconnectDelay: 5000,
            heartbeatIncoming: 0,
            heartbeatOutgoing: 20000,
            connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
            onConnect: () => {
                client.subscribe("/topic/ticker", (msg) => {
                    if (!msg || !msg.body) return;

                    try {
                        const payload = JSON.parse(msg.body);

                        const marketRaw =
                            payload.market ??
                            payload.code ??
                            payload.marketName ??
                            payload.market_name ??
                            (payload.ticker && payload.ticker.market) ??
                            "";

                        const priceRaw =
                            payload.tradePrice ??
                            payload.trade_price ??
                            payload.price ??
                            payload.lastPrice ??
                            payload.last_price ??
                            payload.close ??
                            null;

                        const prevCloseRaw =
                            payload.prevClose ??
                            payload.prev_close ??
                            payload.open ??
                            payload.yesterdayPrice ??
                            null;

                        const volumeRaw =
                            payload.volume ??
                            payload.tradeVolume ??
                            payload.accTradeVolume ??
                            payload.acc_trade_volume ??
                            payload.acc_volume_24h ??
                            payload.changeAmount ??
                            null;

                        const accTradePrice24hRaw =
                            payload.accTradePrice24h ??
                            payload.acc_trade_price_24h ??
                            payload.accTradePrice ??
                            payload.acc_trade_price ??
                            null;

                        const market = String(marketRaw ?? "").trim();
                        if (!market) return;

                        const normalized = normalizeMarket(market);

                        const price = priceRaw != null ? Number(priceRaw) : null;
                        const prevClose = prevCloseRaw != null ? Number(prevCloseRaw) : null;
                        const volume = volumeRaw != null ? Number(volumeRaw) : null;
                        const accTradePrice24h =
                            accTradePrice24hRaw != null ? Number(accTradePrice24hRaw) : null;

                        const change =
                            price != null && prevClose != null
                                ? price - prevClose
                                : payload.change ?? payload.diff ?? null;

                        const changeNum = change != null ? Number(change) : null;

                        const changeRate =
                            payload.changeRate ??
                            payload.change_rate ??
                            (changeNum != null && prevClose
                                ? (changeNum / prevClose) * 100
                                : null);

                        pendingTickersRef.current[normalized] = {
                            price: price ?? null,
                            prevClose: prevClose ?? null,
                            change: changeNum ?? null,
                            changeRate: changeRate ?? null,
                            volume: volume ?? null,
                            accTradePrice24h: accTradePrice24h ?? null,
                            raw: payload,
                        };

                        if (!pendingTickersRef.current._timer) {
                            pendingTickersRef.current._timer = setTimeout(() => {
                                const updates = { ...pendingTickersRef.current };
                                delete updates._timer;
                                setTickers((prev) => ({ ...prev, ...updates }));
                                pendingTickersRef.current = {};
                            }, 100);
                        }
                    } catch (e) {
                        console.error("Failed to parse ticker message", e);
                    }
                });
            },
            onStompError: (frame) => console.error("STOMP error", frame),
            onDisconnect: () => {},
        });

        client.activate();
        stompClientRef.current = client;

        return () => {
            try {
                stompClientRef.current?.deactivate();
            } catch (e) {}
        };
    }, [token]);

    // ---------- Data loaders ----------
    const fetchAll = async () => {
        setLoading(true);
        try {
            await Promise.all([fetchWalletData(), fetchCoins()]);
            await fetchMarkets();
            await fetchFavorites();
        } finally {
            setLoading(false);
        }
    };

    const fetchWalletData = async () => {
        try {
            const results = await Promise.allSettled([
                getTotalAssets(token),
                getTotalEvalAmount(token),
                getTotalProfit(token),
                getTotalProfitRate(token),
                getPortfolioAsset(token),
                getCashBalance(token),
                getTotalCoinBuyAmount(token),
            ]);

            const getValue = (idx, fallback) => {
                const r = results[idx];
                return r && r.status === "fulfilled" ? r.value : fallback;
            };

            const cashBalanceData = getValue(5, 0);
            const cashBalance =
                typeof cashBalanceData === "number" ? cashBalanceData : cashBalanceData?.cashBalance ?? cashBalanceData?.cash_balance ?? 0;

            setSummary((prev) => ({
                ...prev,
                cashBalance,
            }));
        } catch (e) {
            console.error("Wallet fetch error:", e);
        }
    };

    const fetchCoins = async () => {
        if (!token) return;

        try {
            const coinAssets = await getAllCoinAssets(token);
            const normalized = Array.isArray(coinAssets) ? coinAssets : [];

            setRawCoinAssets(normalized);

            const assetPromises = normalized.map(async (c) => {
                const market = extractMarket(c).trim();
                const coinSymbol = extractSymbol(c, market) || "";

                const coinName =
                    (c?.tradingPair && (c.tradingPair.korean_name || c.tradingPair.english_name)) ||
                    c?.korean_name ||
                    c?.english_name ||
                    c?.name ||
                    coinSymbol ||
                    "";

                const buyAmount =
                    Number(c.buyAmount ?? c.buy_amount ?? c.buy_amount_krw ?? calcBuyAmount(c.coinBalance, c.avgBuyPrice)) || 0;

                const amount = Number(c.coinBalance ?? c.coin_balance ?? c.amount ?? 0);
                const avgPrice = Number(c.avgBuyPrice ?? c.avg_buy_price ?? c.avg_price ?? 0);

                return {
                    market,
                    coinSymbol,
                    coinName,
                    amount,
                    avgPrice,
                    buyAmount,
                };
            });

            const prepared = await Promise.all(assetPromises);
            setAssets(
                prepared.map((p) => ({
                    ...p,
                    evalAmount: Math.round(p.amount * p.avgPrice),
                    profit: 0,
                    profitRate: "0.00",
                }))
            );
        } catch (e) {
            console.error("보유코인 데이터 가져오기 실패:", e);
            setAssets([]);
            setRawCoinAssets([]);
        }
    };

    const fetchMarkets = async () => {
        try {
            const data = await getAllMarkets();
            const all = data.tradingPairs || data.trading_pairs || [];
            const onlyKrw = all.filter((m) => String(m.market || "").toUpperCase().startsWith("KRW-"));
            setMarkets(onlyKrw);
        } catch (e) {
            console.error("마켓 불러오기 실패:", e);
        }
    };

    const fetchFavorites = async () => {
        const t = token || (typeof window !== 'undefined' ? getStoredToken(localStorage.getItem('token')) : null);
        if (!t) {
            setFavorites([]);
            return;
        }
        try {
            const data = await getFavoriteCoins(t);

            let arr = [];
            if (!data) {
                arr = [];
            } else if (Array.isArray(data)) {
                arr = data;
            } else if (Array.isArray(data.favoriteCoinList)) {
                arr = data.favoriteCoinList;
            } else if (Array.isArray(data.favorite_list)) {
                arr = data.favorite_list;
            } else if (Array.isArray(data.data?.favoriteCoinList)) {
                arr = data.data.favoriteCoinList;
            } else if (Array.isArray(data.items)) {
                arr = data.items;
            } else if (data.favoriteCoin) {
                arr = [data.favoriteCoin];
            } else {
                const maybe = Object.values(data).find((v) => Array.isArray(v));
                arr = Array.isArray(maybe) ? maybe : [];
            }

            const enriched = arr.map((f) => {
                const copy = { ...f };

                if (!copy.market || !String(copy.market).trim()) {
                    const tpId = copy.tradingPairId ?? copy.trading_pair_id ?? copy.raw?.trading_pair_id ?? copy.raw?.tradingPairId ?? copy.id ?? null;

                    if (tpId != null && Array.isArray(markets) && markets.length > 0) {
                        const found = markets.find((m) =>
                            String(m.id) === String(tpId) ||
                            String(m._id) === String(tpId) ||
                            String(m.tradingPairId) === String(tpId)
                        );
                        if (found) {
                            copy.market = copy.market || found.market || found.code || found.symbol || null;
                            copy.korean_name = copy.korean_name || found.korean_name || found.koreanName || found.name || null;
                            copy._marketMeta = found;
                        }
                    }

                    if ((!copy.market || !String(copy.market).trim()) && copy.raw) {
                        copy.market = copy.raw.market ?? copy.raw.code ?? copy.raw.symbol ?? copy.market ?? null;
                    }
                }

                if (copy.market) copy.market = normalizeMarket(copy.market);

                return copy;
            });

            setFavorites(enriched);
        } catch (e) {
            console.error("관심 코인 불러오기 실패:", e);
            setFavorites([]);
        }
    };

    // ---------- Handlers ----------
    const handleAddKrw = async () => {
        if (!krwInput || isNaN(krwInput) || Number(krwInput) <= 0) {
            return alert("0보다 큰 금액을 입력하세요");
        }
        try {
            await upsertCashBalance(token, Number(krwInput));
            setKrwInput("");
            await fetchWalletData();
            alert("KRW가 성공적으로 등록되었습니다!");
        } catch (e) {
            console.error(e);
            alert("KRW 등록 실패");
        }
    };

    const handleAddCoin = async () => {
        if (!coinInput || coinBalanceInput === "" || isNaN(coinBalanceInput)) {
            return alert("코인과 보유수량을 정확히 입력하세요");
        }
        if (Number(coinBalanceInput) < 0) return alert("보유수량은 0 이상이어야 합니다.");

        if (coinAvgPriceInput === "" || isNaN(coinAvgPriceInput) || Number(coinAvgPriceInput) <= 0) {
            return alert("매수평균가(평단)를 입력하세요");
        }

        try {
            await createCoinAsset(
                {
                    market: coinInput.toUpperCase(),
                    coinBalance: Number(coinBalanceInput),
                    avgBuyPrice: Number(coinAvgPriceInput),
                },
                token
            );

            setCoinInput("");
            setCoinBalanceInput("");
            setCoinAvgPriceInput("");

            await fetchCoins();
            await fetchWalletData();
            alert("코인 등록 완료");
        } catch (e) {
            console.error(e);
            alert("코인 등록 실패");
        }
    };

    const handleAddFavorite = async (marketStr) => {
        const market = (marketStr ?? favInput ?? "").toString().trim();
        if (!market) return alert("추가할 관심 코인을 입력하세요 (예: KRW-BTC 또는 BTC)");
        try {
            const result = await addFavoriteCoin(market.toUpperCase(), token);

            let added = null;
            if (result) {
                if (result.favoriteCoin) added = result.favoriteCoin;
                else if (result.added) added = result.added;
                else if (result.data && result.data.favoriteCoin) added = result.data.favoriteCoin;
                else if (typeof result === "object" && (result.market || result.tradingPair || result.id)) added = result;
            }

            if (added) {
                setFavorites((prev) => {
                    const keyOf = (it) => it.id ?? it._id ?? it.market ?? (it.tradingPair && it.tradingPair.market) ?? JSON.stringify(it);
                    const addedKey = keyOf(added);
                    const filtered = (prev || []).filter((p) => keyOf(p) !== addedKey);
                    return [...filtered, added];
                });
            } else {
                await fetchFavorites();
            }

            setFavInput("");
            alert("관심 코인 추가 완료");
        } catch (e) {
            console.error("관심 코인 추가 실패", e);
            alert(e?.message || "관심 코인 추가 실패");
        }
    };

    // Modified: 부모에서는 confirm을 호출하지 않음. (Favorites 자식에서 confirm 처리)
    const handleDeleteSelectedFavorites = async (idsParam) => {
        const ids = Array.isArray(idsParam) ? idsParam : [];
        if (!ids || ids.length === 0) return alert("삭제할 항목을 선택하세요");
        try {
            await deleteFavoriteCoin(ids, token);
            await fetchFavorites();
            alert("선택한 관심코인 삭제 완료");
        } catch (e) {
            console.error("선택 삭제 실패", e);
            alert(e?.message || "삭제 실패");
        }
    };

    const handleDeleteAllFavorites = async () => {
        if (!confirm("관심코인을 모두 삭제하시겠습니까?")) return;
        try {
            await deleteAllFavoriteCoins(token);
            await fetchFavorites();
            alert("관심코인 전체 삭제 완료");
        } catch (e) {
            console.error("전체 삭제 실패", e);
            alert(e?.message || "전체 삭제 실패");
        }
    };

    const openDrawer = (market) => {
        setSelectedMarket(market);
        setDrawerOpen(true);

        const card = assets.find((a) => a.market === market);
        const raw = rawCoinAssets.find((a) => extractMarket(a) === market);

        setEditCoinBalance(String(card?.amount ?? raw?.coinBalance ?? ""));
        setEditAvgBuyPrice(String(card?.avgPrice ?? raw?.avgBuyPrice ?? ""));
    };

    const closeDrawer = () => {
        setDrawerOpen(false);
        setSelectedMarket(null);
        setEditCoinBalance("");
        setEditAvgBuyPrice("");
    };

    const handleSaveCoinDetail = async () => {
        if (!selectedMarket) return;

        const coinBalance = editCoinBalance === "" ? null : Number(editCoinBalance);
        const avgBuyPrice = editAvgBuyPrice === "" ? null : Number(editAvgBuyPrice);

        if (coinBalance === null || Number.isNaN(coinBalance)) return alert("보유수량을 입력하세요");
        if (coinBalance < 0) return alert("보유수량은 0 이상이어야 합니다.");
        if (avgBuyPrice === null || Number.isNaN(avgBuyPrice) || avgBuyPrice <= 0) return alert("매수평균가(평단)를 입력하세요");

        try {
            await updateCoinAsset({ market: selectedMarket, coinBalance, avgBuyAmount: avgBuyPrice }, token);
            await fetchCoins();
            await fetchWalletData();
            closeDrawer();
            alert("저장 완료");
        } catch (e) {
            console.error(e);
            alert("저장 실패");
        }
    };

    const handleDeleteCoin = async () => {
        if (!selectedMarket) return;
        if (!confirm(`${selectedMarket} 자산을 삭제할까요?`)) return;

        try {
            await deleteCoinAsset(selectedMarket, token);
            await fetchCoins();
            await fetchWalletData();
            closeDrawer();
        } catch (e) {
            console.error("코인 삭제 실패", e);
            alert("코인 삭제 실패");
        }
    };

    const getTickerPriceValue = (marketKey) => {
        if (!marketKey) return undefined;
        const k1 = marketKey;
        const k2 = marketKey.replace("-", "");
        const val = tickers?.[k1] ?? tickers?.[k2];
        if (val === undefined || val === null) return undefined;
        if (typeof val === "number") return val;
        return val.price ?? val.tradePrice ?? val.lastPrice ?? undefined;
    };

    useEffect(() => {
        const newAssets = rawCoinAssets.map((c) => {
            const marketRaw = extractMarket(c).trim();
            const market = normalizeMarket(marketRaw);
            const amount = Number(c.coinBalance ?? c.coin_balance ?? c.amount ?? 0);
            const avgPrice = Number(c.avgBuyPrice ?? c.avg_buy_price ?? c.avg_price ?? 0);

            const tickerPrice = getTickerPriceValue(market);
            const currentPrice = tickerPrice !== undefined ? tickerPrice : avgPrice;

            const evalAmount = Math.round(amount * currentPrice);
            const profit = Math.round(amount * (currentPrice - avgPrice));
            const buyAmount = Number(c.buyAmount ?? c.buy_amount ?? c.buy_amount_krw ?? Math.round(amount * avgPrice)) || 0;
            const profitRate = buyAmount ? ((profit / buyAmount) * 100).toFixed(2) : "0.00";
            const coinSymbol = extractSymbol(c, market) || "";

            return {
                market,
                coinSymbol,
                coinName:
                    (c?.tradingPair && (c.tradingPair.korean_name || c.tradingPair.english_name)) ||
                    c?.korean_name ||
                    c?.english_name ||
                    c?.name ||
                    coinSymbol ||
                    "",
                amount,
                avgPrice,
                buyAmount,
                evalAmount,
                profit,
                profitRate,
            };
        });

        setAssets(newAssets);

        const totalEval = newAssets.reduce((s, a) => s + (a.evalAmount || 0), 0);
        const totalProfit = newAssets.reduce((s, a) => s + (a.profit || 0), 0);
        const totalBuy = newAssets.reduce((s, a) => s + (a.buyAmount || 0), 0);
        const cashBalance = summary.cashBalance ?? 0;
        const totalAsset = totalEval + cashBalance;
        const profitRate = totalBuy ? ((totalProfit / totalBuy) * 100).toFixed(2) : "0.00";

        setSummary((prev) => ({
            ...prev,
            totalEval,
            totalProfit,
            totalBuyAmount: totalBuy,
            totalAsset,
            profitRate,
            cashBalance,
        }));

        const portfolioItems = newAssets.map((a) => ({
            assetName: a.coinSymbol || a.market,
            market: a.market,
            valuation: a.evalAmount,
        }));

        const totalAssetsForPercent = totalAsset || 1;
        const portfolioWithPercent = portfolioItems.map((p) => ({
            tradingPair: p.assetName,
            percent: totalAssetsForPercent === 0 ? 0 : (p.valuation / totalAssetsForPercent) * 100,
            valuation: p.valuation,
            market: p.market,
        }));

        portfolioWithPercent.push({
            tradingPair: "KRW",
            percent: totalAssetsForPercent === 0 ? 0 : (cashBalance / totalAssetsForPercent) * 100,
            valuation: cashBalance,
            market: "KRW",
        });

        setPortfolio(portfolioWithPercent);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rawCoinAssets, tickers]);

    const filteredAssets = useMemo(() => {
        const q = coinFilter.trim().toUpperCase();
        if (!q) return assets;
        return assets.filter(
            (a) => a.market?.toUpperCase().includes(q) || a.coinSymbol?.toUpperCase().includes(q) || a.coinName?.toUpperCase().includes(q)
        );
    }, [assets, coinFilter]);

    // ---------- Render ----------
    return (
        <div className="text-white">
            <div className="px-4 pt-3 border-b border-white/10 flex gap-7">
                <Tab label="보유자산" active={activeTab === "myAssets"} onClick={() => setActiveTab("myAssets")} />
                <Tab label="보유코인" active={activeTab === "coins"} onClick={() => setActiveTab("coins")} />
                <Tab label="포트폴리오" active={activeTab === "portfolio"} onClick={() => setActiveTab("portfolio")} />
                <Tab label="관심코인" active={activeTab === "favorites"} onClick={() => { setActiveTab("favorites"); fetchFavorites(); }} />
            </div>

            <div className="p-4">
                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="text-gray-400 text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                            <p>데이터를 불러오는 중...</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {activeTab === "myAssets" && <MyAssets summary={summary} krwInput={krwInput} setKrwInput={setKrwInput} handleAddKrw={handleAddKrw} />}

                        {activeTab === "coins" && (
                            <MyCoins
                                markets={markets}
                                coinInput={coinInput}
                                setCoinInput={setCoinInput}
                                coinBalanceInput={coinBalanceInput}
                                setCoinBalanceInput={setCoinBalanceInput}
                                coinAvgPriceInput={coinAvgPriceInput}
                                setCoinAvgPriceInput={setCoinAvgPriceInput}
                                handleAddCoin={handleAddCoin}
                                assets={assets}
                                rawCoinAssets={rawCoinAssets}
                                filteredAssets={filteredAssets}
                                openDrawer={openDrawer}
                                drawerOpen={drawerOpen}
                                selectedMarket={selectedMarket}
                                closeDrawer={closeDrawer}
                                onSave={handleSaveCoinDetail}
                                onDelete={handleDeleteCoin}
                                editCoinBalance={editCoinBalance}
                                setEditCoinBalance={setEditCoinBalance}
                                editAvgBuyPrice={editAvgBuyPrice}
                                setEditAvgBuyPrice={setEditAvgBuyPrice}
                                tickers={tickers}
                            />
                        )}

                        {activeTab === "portfolio" && <Portfolio portfolio={portfolio} markets={markets} />}

                        {activeTab === "favorites" && (
                            <Favorites
                                markets={markets}
                                favorites={favorites}
                                tickers={tickers}
                                onAddFavorite={handleAddFavorite}
                                onDeleteSelected={(ids) => handleDeleteSelectedFavorites(ids)}
                                onDeleteAllFavorites={handleDeleteAllFavorites}
                                onQuickAdd={(market) => {
                                    setActiveTab("coins");
                                    setCoinInput(market);
                                }}
                                onDeleteSingle={async (id) => {
                                    try {
                                        const ids = [id];
                                        await deleteFavoriteCoin(ids, token);
                                        await fetchFavorites();
                                    } catch (e) {
                                        console.error("관심코인 단건 삭제 실패", e);
                                        alert("삭제 실패");
                                    }
                                }}
                                loading={loading}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function Tab({ label, active, onClick }) {
    return (
        <button onClick={onClick} className={`pb-3 text-base transition ${active ? "border-b-2 border-white font-semibold text-white" : "text-white/70 hover:text-white"}`}>
            {label}
        </button>
    );
}