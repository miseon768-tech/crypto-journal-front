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

    // favorites UI state
    const [favInput, setFavInput] = useState(""); // 입력으로 관심코인 추가 (legacy)
    const [selectedFavIds, setSelectedFavIds] = useState(new Set()); // 선택 삭제용

    // STOMP / tickers
    // tickers will hold objects per market key:
    // { "KRW-BTC": { price, prevClose, change, changeRate, volume, raw } }
    const [tickers, setTickers] = useState({});
    const pendingTickersRef = useRef({});
    const stompClientRef = useRef(null);

    const token = typeof window !== "undefined" ? getStoredToken(localStorage.getItem("token")) : null;

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

        // cleanup existing client if any
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
                console.info("[STOMP] connected");
                client.subscribe("/topic/ticker", (msg) => {
                    if (!msg || !msg.body) return;
                    try {
                        const payload = JSON.parse(msg.body);

                        // extract market identifier from common fields
                        const marketRaw =
                            payload.market ??
                            payload.code ??
                            payload.marketName ??
                            payload.market_name ??
                            (payload.ticker && payload.ticker.market) ??
                            "";

                        // extract useful numeric fields if present
                        const priceRaw =
                            payload.tradePrice ??
                            payload.trade_price ??
                            payload.price ??
                            payload.lastPrice ??
                            payload.last_price ??
                            payload.close ??
                            null;

                        const prevCloseRaw =
                            payload.prevClose ?? payload.prev_close ?? payload.open ?? payload.yesterdayPrice ?? null;

                        const volumeRaw =
                            payload.volume ??
                            payload.tradeVolume ??
                            payload.accTradeVolume ??
                            payload.acc_trade_volume ??
                            payload.acc_volume_24h ??
                            payload.changeAmount ??
                            null;

                        const market = String(marketRaw ?? "").trim();
                        const price = priceRaw != null ? Number(priceRaw) : null;
                        const prevClose = prevCloseRaw != null ? Number(prevCloseRaw) : null;
                        const volume = volumeRaw != null ? Number(volumeRaw) : null;

                        // if no market or price not number, still try to store raw but ignore numeric-only checks
                        if (!market) return;

                        const normalized = normalizeMarket(market);

                        // compute change, changeRate if possible
                        const change = price != null && prevClose != null ? price - prevClose : (payload.change ?? payload.diff ?? null);
                        const changeNum = change != null ? Number(change) : null;
                        const changeRate =
                            payload.changeRate ??
                            payload.change_rate ??
                            (changeNum != null && prevClose ? (changeNum / prevClose) * 100 : null);

                        // store a rich ticker object in pendingTickersRef
                        pendingTickersRef.current[normalized] = {
                            price: price ?? null,
                            prevClose: prevClose ?? null,
                            change: changeNum ?? null,
                            changeRate: changeRate ?? null,
                            volume: volume ?? null,
                            raw: payload,
                        };

                        // batch updates every 100ms
                        if (!pendingTickersRef.current._timer) {
                            pendingTickersRef.current._timer = setTimeout(() => {
                                const updates = { ...pendingTickersRef.current };
                                delete updates._timer;
                                console.debug("[STOMP] applying ticker updates:", updates);
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
            onDisconnect: () => console.info("[STOMP] disconnected"),
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
            await Promise.all([fetchWalletData(), fetchCoins(), fetchMarkets(), fetchFavorites()]);
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

            if (normalized.length > 0) {
                console.debug("getAllCoinAssets sample:", normalized[0]);
            }

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
            console.debug("fetched markets:", onlyKrw.length, onlyKrw?.[0]);
        } catch (e) {
            console.error("마켓 불러오기 실패:", e);
        }
    };

    const fetchFavorites = async () => {
        if (!token) {
            setFavorites([]);
            return;
        }
        try {
            console.debug("fetchFavorites token:", token);
            const data = await getFavoriteCoins(token);
            console.debug("fetchFavorites - raw response:", data);

            let list = [];
            if (!data) {
                list = [];
            } else if (Array.isArray(data)) {
                list = data;
            } else if (Array.isArray(data.favoriteCoinList)) {
                list = data.favoriteCoinList;
            } else if (Array.isArray(data.favorite_list)) {
                list = data.favorite_list;
            } else if (Array.isArray(data.data?.favoriteCoinList)) {
                list = data.data.favoriteCoinList;
            } else if (Array.isArray(data.items)) {
                list = data.items;
            } else if (data.favoriteCoin) {
                list = [data.favoriteCoin];
            } else {
                const maybe = Object.values(data).find((v) => Array.isArray(v));
                list = Array.isArray(maybe) ? maybe : [];
            }

            console.debug("fetchFavorites - parsed list length:", list.length, list?.[0]);
            setFavorites(list);
            setSelectedFavIds(new Set());
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

    // ---------- Favorites handlers ----------
    const handleAddFavorite = async (marketStr) => {
        const market = (marketStr ?? favInput ?? "").toString().trim();
        if (!market) return alert("추가할 관심 코인을 입력하세요 (예: KRW-BTC 또는 BTC)");
        try {
            console.debug("handleAddFavorite - adding market:", market);
            const result = await addFavoriteCoin(market.toUpperCase(), token);
            console.debug("handleAddFavorite - add result:", result);

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

    const toggleSelectFavorite = (id) => {
        setSelectedFavIds((prev) => {
            const copy = new Set(prev);
            if (copy.has(id)) copy.delete(id);
            else copy.add(id);
            return copy;
        });
    };

    const handleDeleteSelectedFavorites = async () => {
        if (selectedFavIds.size === 0) return alert("삭제할 항목을 선택하세요");
        if (!confirm("선택한 관심코인을 삭제하시겠습니까?")) return;
        try {
            const ids = Array.from(selectedFavIds);
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

    // Make sure openDrawer is defined before render usage
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
            await updateCoinAsset({ market: selectedMarket, coinBalance, avgBuyPrice }, token);
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
            console.error(e);
            alert("코인 삭제 실패");
        }
    };

    // helper to read price from tickers state (handles numeric or object)
    const getTickerPriceValue = (marketKey) => {
        if (!marketKey) return undefined;
        const k1 = marketKey;
        const k2 = marketKey.replace("-", "");
        const val = tickers?.[k1] ?? tickers?.[k2];
        if (val === undefined || val === null) return undefined;
        if (typeof val === "number") return val;
        return val.price ?? val.tradePrice ?? val.lastPrice ?? undefined;
    };

    // ---------- Compute assets from rawCoinAssets + tickers ----------
    useEffect(() => {
        const newAssets = rawCoinAssets.map((c) => {
            const marketRaw = extractMarket(c).trim();
            const market = normalizeMarket(marketRaw); // normalized
            const amount = Number(c.coinBalance ?? c.coin_balance ?? c.amount ?? 0);
            const avgPrice = Number(c.avgBuyPrice ?? c.avg_buy_price ?? c.avg_price ?? 0);

            // read ticker price from tickers (supports both number and object)
            const tickerObj = tickers[market] ?? tickers[market.replace("-", "")];
            const tickerPrice = getTickerPriceValue(market);
            const currentPrice = tickerPrice !== undefined ? tickerPrice : avgPrice;

            // debug
            console.debug(`[ASSET] ${marketRaw} -> ${market} | tickerObj=`, tickerObj, "| currentPrice=", currentPrice, "avg=", avgPrice);

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

        // Recalculate summary
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

        // Recalculate portfolio
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

                        {activeTab === "portfolio" && <Portfolio portfolio={portfolio} />}

                        {activeTab === "favorites" && (
                            <Favorites
                                markets={markets}
                                favorites={favorites}
                                tickers={tickers} // <-- pass rich tickers to Favorites for display
                                favInput={favInput}
                                setFavInput={setFavInput}
                                onAddFavorite={handleAddFavorite}
                                selectedFavIds={selectedFavIds}
                                toggleSelectFavorite={toggleSelectFavorite}
                                onDeleteSelectedFavorites={handleDeleteSelectedFavorites}
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