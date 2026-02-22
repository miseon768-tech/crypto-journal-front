import React, { useEffect, useMemo, useRef, useState } from "react";
import MyAssets from "./wallet/MyAssets";
import MyCoins from "./wallet/MyCoins";
import Portfolio from "./wallet/Portfolio";

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

import { getFavoriteCoins } from "../api/favoriteCoin";
import { getAllMarkets } from "../api/tradingPair";
import { getStoredToken } from "../api/member";

import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

/**
 * WalletComponent - Wallet 전체(보유자산 / 보유코인 / 포트폴리오)에 실시간 현재가 반영
 *
 * 핵심 변경:
 * - SockJS에 절대 백엔드 URL 사용 (REACT_APP_BACKEND_WS_URL 또는 기본 http://localhost:8080/ws)
 * - CONNECT 시 Authorization 헤더로 토큰 전달
 * - 수신 마켓 정규화(normalizeMarket)로 키 매칭 안정화
 * - 디버그 로그 추가: 연결/수신/배치 적용/자산 재계산
 *
 * 환경변수:
 * - REACT_APP_BACKEND_WS_URL (예: "http://localhost:8080/ws")
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

    // STOMP / tickers
    const [tickers, setTickers] = useState({}); // ex: { "KRW-BTC": 60000000, ... }
    const pendingTickersRef = useRef({});
    const stompClientRef = useRef(null);

    const token =
        typeof window !== "undefined"
            ? getStoredToken(localStorage.getItem("token"))
            : null;

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
                            payload.tradePriceKr ??
                            payload.trade_price_krw;

                        const market = String(marketRaw ?? "").trim();
                        const price = Number(priceRaw);

                        if (!market || Number.isNaN(price)) return;

                        const normalized = normalizeMarket(market);

                        // Debug log
                        console.debug("[STOMP] recv ticker:", { marketRaw, normalized, price });

                        pendingTickersRef.current[normalized] = price;
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
                typeof cashBalanceData === "number"
                    ? cashBalanceData
                    : cashBalanceData?.cashBalance ?? cashBalanceData?.cash_balance ?? 0;

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
        } catch (e) {
            console.error("마켓 불러오기 실패:", e);
        }
    };

    const fetchFavorites = async () => {
        if (!token) return;
        try {
            const data = await getFavoriteCoins(token);
            setFavorites(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error("관심 코인 불러오기 실패:", e);
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

    // ---------- Compute assets from rawCoinAssets + tickers ----------
    useEffect(() => {
        const newAssets = rawCoinAssets.map((c) => {
            const marketRaw = extractMarket(c).trim();
            const market = normalizeMarket(marketRaw); // normalized
            const amount = Number(c.coinBalance ?? c.coin_balance ?? c.amount ?? 0);
            const avgPrice = Number(c.avgBuyPrice ?? c.avg_buy_price ?? c.avg_price ?? 0);

            // try ticker with normalized key, and alt without hyphen
            const tickerPrice = tickers[market];
            const tickerPriceAlt = tickers[market.replace("-", "")];

            const currentPrice = tickerPrice !== undefined ? tickerPrice : (tickerPriceAlt !== undefined ? tickerPriceAlt : avgPrice);

            // debug
            console.debug(`[ASSET] ${marketRaw} -> ${market} | ticker=${tickerPrice} alt=${tickerPriceAlt} current=${currentPrice} avg=${avgPrice}`);

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
            (a) =>
                a.market?.toUpperCase().includes(q) ||
                a.coinSymbol?.toUpperCase().includes(q) ||
                a.coinName?.toUpperCase().includes(q)
        );
    }, [assets, coinFilter]);

    // ---------- Render ----------
    return (
        <div className="text-white">
            <div className="px-4 pt-3 border-b border-white/10 flex gap-7">
                <Tab label="보유자산" active={activeTab === "myAssets"} onClick={() => setActiveTab("myAssets")} />
                <Tab label="보유코인" active={activeTab === "coins"} onClick={() => setActiveTab("coins")} />
                <Tab label="포트폴리오" active={activeTab === "portfolio"} onClick={() => setActiveTab("portfolio")} />
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
                        {activeTab === "myAssets" && (
                            <MyAssets
                                summary={summary}
                                krwInput={krwInput}
                                setKrwInput={setKrwInput}
                                handleAddKrw={handleAddKrw}
                            />
                        )}

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
                    </>
                )}
            </div>
        </div>
    );
}

function Tab({ label, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`pb-3 text-base transition ${active ? "border-b-2 border-white font-semibold text-white" : "text-white/70 hover:text-white"}`}
        >
            {label}
        </button>
    );
}