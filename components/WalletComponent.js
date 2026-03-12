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
                        const marketRaw = payload.market ?? payload.code ?? "";
                        const normalized = normalizeMarket(marketRaw);
                        if (!normalized) return;

                        pendingTickersRef.current[normalized] = {
                            price: Number(payload.tradePrice ?? payload.price ?? 0),
                            changeRate: Number(payload.changeRate ?? 0),
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
        try {
            await Promise.all([fetchWalletData(), fetchCoins()]);
            await fetchMarkets();
            await fetchFavorites();
        } finally {
            setLoading(false);
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
            const cashBalanceData = getValue(5, 0);
            const totalBuyAmount = getValue(6, 0);

            const cashBalance = typeof cashBalanceData === "number"
                ? cashBalanceData
                : (cashBalanceData?.cashBalance ?? cashBalanceData?.cash_balance ?? 0);

            // 데이터를 바구니(Summary)에 담습니다.
            setSummary({
                totalAsset: Number(totalAsset),
                totalEval: Number(totalEval),
                totalProfit: Number(totalProfit),
                profitRate: String(profitRate),
                cashBalance: Number(cashBalance),
                totalBuyAmount: Number(totalBuyAmount),
            });
        } catch (e) {
            console.error("Wallet fetch error:", e);
        }
    };

    const fetchCoins = async () => {
        try {
            const coinAssets = await getAllCoinAssets(token);
            const normalized = Array.isArray(coinAssets) ? coinAssets : [];
            setRawCoinAssets(normalized);
            const prepared = normalized.map((c) => {
                const market = extractMarket(c).trim();
                const amount = Number(c.coinBalance ?? 0);
                const avgPrice = Number(c.avgBuyPrice ?? 0);
                return {
                    market,
                    coinSymbol: extractSymbol(c, market),
                    coinName: c?.korean_name || c?.name || "",
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
        const all = data.tradingPairs || [];
        setMarkets(all.filter(m => String(m.market).startsWith("KRW-")));
    };

    const fetchFavorites = async () => {
        const data = await getFavoriteCoins(token);
        setFavorites(Array.isArray(data) ? data : (data?.favoriteCoinList || []));
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

    const handleDeleteSelectedFavorites = async (ids) => {
        if (!confirm("삭제하시겠습니까?")) return;
        await deleteFavoriteCoin(ids, token);
        await fetchFavorites();
    };

    const openDrawer = (market) => {
        setSelectedMarket(market);
        const card = assets.find(a => a.market === market);
        setEditCoinBalance(String(card?.amount || ""));
        setEditAvgBuyPrice(String(card?.avgPrice || ""));
        setDrawerOpen(true);
    };

    const closeDrawer = () => { setDrawerOpen(false); setSelectedMarket(null); };

    const handleSaveCoinDetail = async () => {
        await updateCoinAsset({ market: selectedMarket, coinBalance: Number(editCoinBalance), avgBuyAmount: Number(editAvgBuyPrice) }, token);
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
            const currentPrice = tickers[market]?.price || avgPrice;
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
                        {activeTab === "myAssets" && <MyAssets summary={summary} krwInput={krwInput} setKrwInput={setKrwInput} handleAddKrw={handleAddKrw} />}
                        {activeTab === "coins" && (
                            <MyCoins
                                assets={assets} filteredAssets={filteredAssets} openDrawer={openDrawer}
                                coinInput={coinInput} setCoinInput={setCoinInput} coinBalanceInput={coinBalanceInput} setCoinBalanceInput={setCoinBalanceInput}
                                coinAvgPriceInput={coinAvgPriceInput} setCoinAvgPriceInput={setCoinAvgPriceInput} handleAddCoin={handleAddCoin}
                                drawerOpen={drawerOpen} closeDrawer={closeDrawer} onSave={handleSaveCoinDetail} onDelete={handleDeleteCoin}
                                editCoinBalance={editCoinBalance} setEditCoinBalance={setEditCoinBalance} editAvgBuyPrice={editAvgBuyPrice} setEditAvgBuyPrice={setEditAvgBuyPrice}
                                selectedMarket={selectedMarket} markets={markets}
                            />
                        )}
                        {activeTab === "portfolio" && <Portfolio portfolio={portfolio} markets={markets} />}
                        {activeTab === "favorites" && (
                            <Favorites
                                favorites={favorites} tickers={tickers} markets={markets}
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