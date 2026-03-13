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
 */
export default function WalletComponent() {
    useEffect(() => {
        if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.debug("[Wallet] mounted");
        }
    }, []);
    const [activeTab, setActiveTab] = useState("myAssets");

    // summary 키는 MyAssets가 기대하는 형태로 유지한다.
    // (초기값에서 키가 어긋나면 첫 렌더에서 0으로 보이거나, 일부 계산이 꼬일 수 있음)
    const [summary, setSummary] = useState({
        totalAssets: 0,
        totalEvalAmount: 0,
        totalProfit: 0,
        totalProfitRate: "0.00",
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
    const [favInput, setFavInput] = useState("");

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
    }, [token]);

    // 보유코인(추가/수정/삭제) 또는 실시간 가격 반영으로 보유코인 평가가 바뀌면,
    // 보유자산(summary)은 백엔드 요약값을 다시 조회해서 동기화한다.
    // (현재 UI에서 코인 탭에서 변경 후 보유자산 탭이 안 변하는 체감 문제 해결)
    useEffect(() => {
        if (!token) return;
        // 최초 로딩/토큰 세팅 직후 fetchAll에서 이미 호출되므로, 그 이후 변화만 반영
        // rawCoinAssets가 아직 비어있는 초기 구간에서는 호출을 줄인다.
        if (!Array.isArray(rawCoinAssets)) return;
        if (rawCoinAssets.length === 0) {
            // 코인이 0개가 된 경우도 summary 갱신 필요 (현금만 남는 케이스)
            fetchWalletData();
            return;
        }
        fetchWalletData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, rawCoinAssets]);

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
        return "";
    };

    const extractSymbol = (c, marketStr) => {
        if (typeof marketStr === "string" && marketStr.includes("-")) return marketStr.split("-")[1];
        const tp = c?.tradingPair ?? c?.trading_pair;
        if (tp && typeof tp === "object") return tp.symbol ?? tp.english_name ?? "";
        return "";
    };

    const calcBuyAmount = (coinBalance, avgBuyPrice) => Math.round((Number(coinBalance) || 0) * (Number(avgBuyPrice) || 0));

    // --------- STOMP 연결 ----------
    useEffect(() => {
        if (!token) return;
        const backendBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
        const backendWsUrl = `${backendBaseUrl}/ws`;

        const client = new Client({
            webSocketFactory: () => new SockJS(backendWsUrl),
            reconnectDelay: 5000,
            connectHeaders: { Authorization: `Bearer ${token}` },
            onConnect: () => {
                client.subscribe("/topic/ticker", (msg) => {
                    try {
                        const payload = JSON.parse(msg.body);
                        // 백엔드는 ticker DTO에서 market 대신 code(KRW-BTC)를 내려줍니다.
                        const marketRaw = payload.market ?? payload.code ?? payload.marketCode ?? payload.symbol ?? "";
                        const normalized = normalizeMarket(marketRaw);
                        if (!normalized) return;

                        pendingTickersRef.current[normalized] = {
                            // 원래 동작(정상 시점)과 동일하게: 가격 + 등락률만 저장
                            price: Number(payload.tradePrice ?? payload.trade_price ?? payload.price ?? payload.trade ?? 0),
                            changeRate: Number(payload.signedChangeRate ?? payload.signed_change_rate ?? payload.changeRate ?? payload.change_rate ?? 0),
                            // Favorites(관심코인)에서 사용하는 거래대금 필드도 함께 저장
                            // (백엔드 Provider ticker DTO: accTradePrice / accTradePrice24h)
                            accTradePrice: Number(payload.accTradePrice ?? payload.acc_trade_price ?? 0) || 0,
                            // upbit ticker websocket은 acc_trade_price24h (언더스코어 없이 24h)
                            accTradePrice24h: Number(payload.accTradePrice24h ?? payload.acc_trade_price24h ?? payload.acc_trade_price_24h ?? 0) || 0,
                        };

                        if (!pendingTickersRef.current._timer) {
                            pendingTickersRef.current._timer = setTimeout(() => {
                                const updates = { ...pendingTickersRef.current };
                                delete updates._timer;
                                setTickers((prev) => ({ ...prev, ...updates }));
                                pendingTickersRef.current = {};
                            }, 100);
                        }
                    } catch (e) { console.error(e); }
                });
            },
        });
        client.activate();
        stompClientRef.current = client;
        return () => stompClientRef.current?.deactivate();
    }, [token]);

    // ---------- Data loaders ----------
    const fetchAll = async () => {
        setLoading(true);
        if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.debug("[Wallet] fetchAll start");
        }
        try {
            // 순서 중요:
            // 1) 보유코인(rawCoinAssets) 갱신
            // 2) markets/favorites 갱신
            // 3) summary/portfolio 갱신 (portfolio는 rawCoinAssets를 힌트로 사용)
            await fetchCoins();
            await Promise.all([fetchMarkets(), fetchFavorites()]);
            await fetchWalletData();
        } finally {
            setLoading(false);
            if (process.env.NODE_ENV !== "production") {
                // eslint-disable-next-line no-console
                console.debug("[Wallet] fetchAll end");
            }
        }
    };

    // ✅ 수정된 fetchWalletData: 가져온 데이터를 summary 상태에 정확히 push 합니다.
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

            const totalAsset = getValue(0, 0);
            const totalEval = getValue(1, 0);
            const totalProfit = getValue(2, 0);
            const profitRate = getValue(3, 0);
            const portfolioData = getValue(4, []);
            const cashBalanceData = getValue(5, 0);
            const totalBuyAmount = getValue(6, 0);

            // dev only: raw payload snapshot
            if (process.env.NODE_ENV !== "production") {
                // eslint-disable-next-line no-console
                console.debug("[Wallet] summary raw", {
                    totalAsset,
                    totalEval,
                    totalProfit,
                    profitRate,
                    cashBalanceData,
                    totalBuyAmount,
                    portfolioDataSample: Array.isArray(portfolioData)
                        ? portfolioData.slice(0, 3)
                        : (portfolioData?.portfolioItemList?.slice?.(0, 3) ?? portfolioData),
                });
            }

            const cashBalance = typeof cashBalanceData === "number"
                ? cashBalanceData
                : (cashBalanceData?.cashBalance ?? cashBalanceData?.cash_balance ?? 0);

            // ---- Front sanity/consistency fixes ----
            // 백엔드(AssetPriceStreamService)가 이미 평가손익/수익률을 아래 정의로 계산해 내려줍니다.
            // - totalProfit = Σ(balance * (tradePrice - avgBuyPrice))  => 이익(+), 손실(-)
            // - totalProfitRate = totalProfit / totalBuyAmount * 100
            // 프론트는 원칙적으로 서버 값을 그대로 표시하고, 값이 누락/NaN일 때만 폴백으로 재계산합니다.
            const nTotalEval = Number(totalEval) || 0;
            const nCash = Number(cashBalance) || 0;
            const nBuy = Number(totalBuyAmount) || 0;
            const nTotalProfitApi = Number(totalProfit);
            const nProfitRateApi = Number(profitRate);

            // 폴백: 서버 요약값이 일시적으로 비어있을 경우에만 (총평가 - 총매수)로 추정
            // (서버 계산식과 완전히 동일하진 않지만, 사용자에게 0으로 보이는 것보단 낫습니다.)
            const computedProfitFallback = nBuy > 0 ? (nTotalEval - nBuy) : 0;
            const useProfit = Number.isFinite(nTotalProfitApi) ? nTotalProfitApi : computedProfitFallback;

            const computedRateFallback = nBuy > 0 ? (useProfit / nBuy) * 100 : 0;
            const useRate = Number.isFinite(nProfitRateApi) ? nProfitRateApi : computedRateFallback;

            // 데이터를 바구니(Summary)에 담습니다.
            // ⚠️ MyAssets는 백엔드 summary 응답 키를 기준으로 동작하므로, 여기서도 동일 키로 저장합니다.
            // - totalAssets / totalEvalAmount / totalProfit / totalProfitRate / cashBalance / totalBuyAmount
            setSummary({
                totalAssets: Number(totalAsset) || (nTotalEval + nCash),
                totalEvalAmount: nTotalEval,
                totalProfit: useProfit,
                totalProfitRate: Number.isFinite(useRate) ? useRate : 0,
                cashBalance: nCash,
                totalBuyAmount: nBuy,
            });

            // ✅ portfolio state 업데이트
            // 백엔드 PortfolioItem.asset 이 'BTC'가 아니라 'P', 'NTY' 같은 값으로 내려오는 케이스가 있어
            // 프론트에서 최대한 한글명(심볼)로 표시할 수 있도록, 보유코인(rawCoinAssets) 정보를 이용해 힌트를 주입한다.
            const rawPortfolio = Array.isArray(portfolioData)
                ? portfolioData
                : (portfolioData?.portfolioItemList || portfolioData?.portfolio || []);

            if (process.env.NODE_ENV !== "production") {
                // eslint-disable-next-line no-console
                console.debug("[Wallet] portfolio raw list(sample)", (rawPortfolio || []).slice(0, 5));
            }

            // 심볼/마켓 -> 보유코인(tradingPair) 매핑
            const coinHintBySymbol = new Map();
            for (const c of (rawCoinAssets || [])) {
                const mkt = normalizeMarket(extractMarket(c));
                const sym = (mkt.includes("-") ? mkt.split("-")[1] : (extractSymbol(c, mkt) || "")).toUpperCase();
                if (!sym) continue;
                const tp = c?.tradingPair ?? c?.trading_pair;
                coinHintBySymbol.set(sym, {
                    market: mkt,
                    korean_name: c?.korean_name ?? c?.koreanName ?? tp?.korean_name ?? tp?.koreanName ?? null,
                    name: c?.name ?? tp?.english_name ?? tp?.englishName ?? null,
                });
            }

            const normalizedPortfolio = (rawPortfolio || []).map((p) => {
                const asset = String(p?.asset ?? p?.market ?? p?.tradingPair ?? "").trim().toUpperCase();
                const hint = asset ? coinHintBySymbol.get(asset) : null;
                return hint
                    ? { ...p, market: p?.market ?? hint.market, koreanName: p?.koreanName ?? hint.korean_name, korean_name: p?.korean_name ?? hint.korean_name }
                    : p;
            });

            if (process.env.NODE_ENV !== "production") {
                // eslint-disable-next-line no-console
                console.debug("[Wallet] portfolio normalized(sample)", normalizedPortfolio.slice(0, 5));
                // eslint-disable-next-line no-console
                console.debug("[Wallet] coinHintBySymbol keys(sample)", Array.from(coinHintBySymbol.keys()).slice(0, 20));
            }

            setPortfolio(normalizedPortfolio);
        } catch (e) {
            console.error("Wallet fetch error:", e);
        }
    };

    const fetchCoins = async () => {
        try {
            const coinAssets = await getAllCoinAssets(token);
            const normalized = Array.isArray(coinAssets) ? coinAssets : [];
            setRawCoinAssets(normalized);

            if (process.env.NODE_ENV !== "production") {
                // eslint-disable-next-line no-console
                console.debug("[Wallet] coinAssets raw(sample)", normalized.slice(0, 3));
            }
            const prepared = normalized.map((c) => {
                const market = extractMarket(c).trim();
                const amount = Number(c.coinBalance ?? 0);
                const avgPrice = Number(c.avgBuyPrice ?? 0);
                return {
                    market,
                    coinSymbol: extractSymbol(c, market),
                    coinName: c?.korean_name || c?.name || "",
                    // MyCoins 컴포넌트는 amount/avgPrice 또는 coinBalance/avgBuyPrice를 모두 허용하지만,
                    // 일부 렌더 로직에서 amount/avgPrice를 직접 참조하므로 alias를 함께 제공
                    coinBalance: amount,
                    avgBuyPrice: avgPrice,
                    amount,
                    avgPrice,
                    buyAmount: calcBuyAmount(amount, avgPrice),
                };
            });
            setAssets(prepared.map(p => ({ ...p, evalAmount: p.buyAmount, profit: 0, profitRate: "0.00" })));
        } catch (e) { console.error(e); }
    };

    const fetchMarkets = async () => {
        const data = await getAllMarkets();
        const all = data?.tradingPairs || data?.trading_pairs || [];
        setMarkets(all.filter(m => String(m.market).startsWith("KRW-")));

        if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.debug("[Wallet] markets loaded", {
                rawKeys: Object.keys(data || {}),
                total: Array.isArray(all) ? all.length : 0,
                sample: Array.isArray(all) ? all.slice(0, 3) : all,
            });
        }
    };

    const fetchFavorites = async () => {
        try {
            const data = await getFavoriteCoins(token);
            const list = Array.isArray(data) ? data : (data?.favoriteCoinList || data?.favorites || []);
            // Favorites 컴포넌트는 f.market 기반으로 ticker를 찾으므로 market을 최대한 채워준다.
            const normalized = (Array.isArray(list) ? list : []).map((f) => {
                const market = normalizeMarket(
                    f?.market ?? f?.tradingPairMarket ?? f?.trading_pair_market ?? f?.code ?? f?.symbol ?? ""
                );
                const tp = f?.tradingPair ?? f?.trading_pair;
                const marketFromTp = normalizeMarket(tp?.market ?? tp?.symbol ?? tp?.name ?? "");
                return {
                    ...f,
                    market: market || marketFromTp || f?.market || "",
                    korean_name: f?.korean_name ?? tp?.korean_name ?? tp?.koreanName ?? f?.koreanName,
                    name: f?.name ?? tp?.name ?? tp?.english_name ?? tp?.englishName,
                };
            });
            setFavorites(normalized);
        } catch (e) {
            console.error("fetchFavorites error:", e);
            setFavorites([]);
        }
    };

    const handleAddFavorite = async (market) => {
        const m = normalizeMarket(market);
        if (!m) return;
        await addFavoriteCoin(m, token);
        await fetchFavorites();
    };

    // ---------- Handlers ----------
    const handleAddKrw = async () => {
        if (Number(krwInput) <= 0) return alert("금액을 확인하세요");
        await upsertCashBalance(token, Number(krwInput));
        setKrwInput("");
        await fetchWalletData();
    };

    const handleAddCoin = async () => {
        await createCoinAsset({ market: coinInput.toUpperCase(), coinBalance: Number(coinBalanceInput), avgBuyPrice: Number(coinAvgPriceInput) }, token);
        setCoinInput(""); setCoinBalanceInput(""); setCoinAvgPriceInput("");
        await fetchAll();
    };

    const handleDeleteSelectedFavorites = async (idsOrKeys) => {
        if (!confirm("삭제하시겠습니까?")) return;
        const keys = Array.isArray(idsOrKeys) ? idsOrKeys : [];

        // Favorites 컴포넌트는 id / tradingPairId / market 등을 key로 넘긴다.
        // 백엔드 delete API가 무엇을 받는지에 따라 최대한 안전하게 처리:
        // 1) 숫자/UUID처럼 보이면 그대로 id로 시도
        // 2) market(KRW-BTC)처럼 보이면 해당 항목의 id/tradingPairId를 찾아서 id로 시도
        const toIdCandidates = (k) => {
            if (k == null) return [];
            const s = String(k).trim();
            if (!s) return [];
            // market 형태면 favorites에서 찾아 id/tradingPairId로 변환
            if (s.includes("-")) {
                const mk = normalizeMarket(s);
                const match = favorites.find((f) => normalizeMarket(f?.market) === mk);
                const id = match?.id ?? match?._id;
                const tpId = match?.tradingPairId ?? match?.trading_pair_id;
                return [id, tpId, mk].filter(Boolean);
            }
            return [s];
        };

        const flattened = keys.flatMap(toIdCandidates).filter(Boolean);

        // 우선 다건 삭제로 시도
        try {
            await deleteFavoriteCoin(flattened, token);
        } catch (e) {
            // 실패 시 개별 삭제(백엔드가 단건만 지원하는 경우 대비)
            console.warn("bulk deleteFavoriteCoin failed, trying individually", e);
            for (const k of flattened) {
                try {
                    await deleteFavoriteCoin(k, token);
                } catch (e2) {
                    console.error("deleteFavoriteCoin failed for", k, e2);
                }
            }
        }
        await fetchFavorites();
    };

    const openDrawer = (market) => {
        setSelectedMarket(market);
        const card = assets.find(a => a.market === market);
        setEditCoinBalance(String(card?.amount ?? ""));
        setEditAvgBuyPrice(String(card?.avgPrice ?? ""));
        setDrawerOpen(true);
    };

    const closeDrawer = () => { setDrawerOpen(false); setSelectedMarket(null); };

    const handleSaveCoinDetail = async () => {
        // API 스펙: avgBuyPrice (avgBuyAmount 아님)
        await updateCoinAsset({ market: selectedMarket, coinBalance: Number(editCoinBalance), avgBuyPrice: Number(editAvgBuyPrice) }, token);
        await fetchAll(); closeDrawer();
    };

    const handleDeleteCoin = async () => {
        await deleteCoinAsset(selectedMarket, token);
        await fetchAll(); closeDrawer();
    };

    // ---------- 실시간 가격 반영 로직 ----------
    useEffect(() => {
        const newAssets = rawCoinAssets.map((c) => {
            const market = normalizeMarket(extractMarket(c));
            const amount = Number(c.coinBalance ?? 0);
            const avgPrice = Number(c.avgBuyPrice ?? 0);
            const currentPrice = tickers[market]?.price ?? avgPrice;
            const evalAmount = Math.round(amount * currentPrice);
            const buyAmount = Math.round(amount * avgPrice);
            const profit = evalAmount - buyAmount;

            return {
                market,
                coinSymbol: extractSymbol(c, market),
                amount,
                avgPrice,
                buyAmount,
                evalAmount,
                profit,
                profitRate: buyAmount ? ((profit / buyAmount) * 100).toFixed(2) : "0.00"
            };
        });

        setAssets(newAssets);
        // 포트폴리오 및 요약 계산은 Summary 상태에 의존하여 MyAssets에서 렌더링됩니다.
    }, [tickers, rawCoinAssets]);

    const filteredAssets = useMemo(() => {
        const q = coinFilter.trim().toUpperCase();
        return q ? assets.filter(a => a.market.includes(q) || a.coinSymbol.includes(q)) : assets;
    }, [assets, coinFilter]);

    // MyAssets는 백엔드 summary 응답 키를 기준으로 표시함
    // (totalAssets, totalEvalAmount, totalProfit, totalProfitRate)
    const myAssetsSummary = useMemo(() => {
        const n = (v) => {
            const x = Number(v);
            return Number.isFinite(x) ? x : 0;
        };

        const totalEvalAmount = n(summary?.totalEvalAmount);
        const totalProfit = n(summary?.totalProfit);
        const totalBuyAmount = n(summary?.totalBuyAmount);
        const cashBalance = n(summary?.cashBalance);

        const rawRate = Number(summary?.totalProfitRate);
        const totalProfitRate = Number.isFinite(rawRate)
            ? rawRate
            : (totalBuyAmount > 0 ? (totalProfit / totalBuyAmount) * 100 : 0);

        const totalAssets = n(summary?.totalAssets) || (totalEvalAmount + cashBalance);

        return {
            totalAssets,
            totalEvalAmount,
            totalProfit,
            totalProfitRate,
            cashBalance,
            totalBuyAmount,
        };
    }, [summary]);

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
                    <div className="flex justify-center py-20"><div className="animate-spin h-12 w-12 border-b-2 border-indigo-500 rounded-full"></div></div>
                ) : (
                    <>
                        {activeTab === "myAssets" && <MyAssets summary={myAssetsSummary} krwInput={krwInput} setKrwInput={setKrwInput} handleAddKrw={handleAddKrw} />}
                        {activeTab === "coins" && (
                            <MyCoins
                                assets={assets} filteredAssets={filteredAssets} openDrawer={openDrawer}
                                coinInput={coinInput} setCoinInput={setCoinInput} coinBalanceInput={coinBalanceInput} setCoinBalanceInput={setCoinBalanceInput}
                                coinAvgPriceInput={coinAvgPriceInput} setCoinAvgPriceInput={setCoinAvgPriceInput} handleAddCoin={handleAddCoin}
                                drawerOpen={drawerOpen} closeDrawer={closeDrawer} onSave={handleSaveCoinDetail} onDelete={handleDeleteCoin}
                                editCoinBalance={editCoinBalance} setEditCoinBalance={setEditCoinBalance} editAvgBuyPrice={editAvgBuyPrice} setEditAvgBuyPrice={setEditAvgBuyPrice}
                                selectedMarket={selectedMarket} markets={markets}
                                tickers={tickers}
                            />
                        )}
                        {activeTab === "portfolio" && <Portfolio portfolio={portfolio} markets={markets} />}
                        {activeTab === "favorites" && (
                            <Favorites
                                favorites={favorites} tickers={tickers} markets={markets}
                                onAddFavorite={handleAddFavorite}
                                onDeleteSelected={handleDeleteSelectedFavorites}
                                onQuickAdd={(m) => { setActiveTab("coins"); setCoinInput(m); }}
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
        <button onClick={onClick} className={`pb-3 text-base transition ${active ? "border-b-2 border-white font-semibold" : "text-white/70 hover:text-white"}`}>
            {label}
        </button>
    );
}