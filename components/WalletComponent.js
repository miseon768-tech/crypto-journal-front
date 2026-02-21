import React, { useEffect, useMemo, useState } from "react";
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

export default function WalletComponent() {
    const [activeTab, setActiveTab] = useState("myAssets");

    const [summary, setSummary] = useState({
        totalAsset: 0,
        totalEval: 0,
        totalProfit: 0,
        profitRate: 0,
        cashBalance: 0,
        totalBuyAmount: 0,
    });

    const [assets, setAssets] = useState([]); // 가공 데이터
    const [rawCoinAssets, setRawCoinAssets] = useState([]); // 백엔드 원본
    const [portfolio, setPortfolio] = useState([]);
    const [loading, setLoading] = useState(true);
    const [markets, setMarkets] = useState([]);
    const [favorites, setFavorites] = useState([]);

    // inputs
    const [krwInput, setKrwInput] = useState("");

    // coin 등록 inputs
    const [coinInput, setCoinInput] = useState("");
    const [coinBalanceInput, setCoinBalanceInput] = useState("");
    const [coinAvgPriceInput, setCoinAvgPriceInput] = useState("");

    // 상세/수정 drawer state (유지: MyCoins가 UI 사용)
    const [selectedMarket, setSelectedMarket] = useState(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editCoinBalance, setEditCoinBalance] = useState("");
    const [editAvgBuyPrice, setEditAvgBuyPrice] = useState("");

    // 리스트 검색
    const [coinFilter, setCoinFilter] = useState("");

    const token =
        typeof window !== "undefined"
            ? getStoredToken(localStorage.getItem("token"))
            : null;

    useEffect(() => {
        if (!token) return;
        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    // ---------- Helpers ----------
    // 더 안전한 market 추출기 (tradingPair가 객체/숫자/문자열 어떤 형태로 와도 처리)
    const extractMarket = (c) => {
        if (!c) return "";
        // 우선 직접 제공되는 필드들 확인
        if (typeof c.market === "string" && c.market.trim()) return c.market.trim();

        // tradingPair 혹은 trading_pair 필드가 객체인 경우 내부의 시장 식별자 확인
        const tp = c.tradingPair ?? c.trading_pair;
        if (tp && typeof tp === "object") {
            // 가능한 필드명들을 순서대로 시도
            const candidates = [tp.market, tp.symbol, tp.name, tp.english_name, tp.korean_name];
            for (const x of candidates) {
                if (typeof x === "string" && x.trim()) return x.trim();
            }
        }

        // tradingPair가 문자열/숫자(아이디)로 왔을 경우
        if (typeof tp === "string" && tp.trim()) return tp.trim();
        if (typeof tp === "number") return String(tp);

        // 기타 대체 필드
        const alt = c.market_name ?? c.marketString ?? c.symbol ?? c.coinSymbol;
        if (typeof alt === "string" && alt.trim()) return alt.trim();

        return "";
    };

    // coinSymbol 추출기: market 문자열에서 "-" 뒤 심볼을 우선, 없으면 tradingPair 내부 역할 필드 사용
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

        // fallback: if marketStr is non-empty return it, else empty string
        return typeof marketStr === "string" && marketStr ? marketStr : "";
    };

    const calcBuyAmount = (coinBalance, avgBuyPrice) => {
        return Math.round((Number(coinBalance) || 0) * (Number(avgBuyPrice) || 0));
    };

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

            const totalAssetData = getValue(0, 0);
            const totalEvalData = getValue(1, 0);
            const totalProfitData = getValue(2, 0);
            const profitRateData = getValue(3, 0);
            const portfolioData = getValue(4, []);
            const cashBalanceData = getValue(5, 0);
            const totalBuyAmountData = getValue(6, 0);

            const totalAsset =
                typeof totalAssetData === "number"
                    ? totalAssetData
                    : totalAssetData?.totalAssets ?? 0;
            const totalEval =
                typeof totalEvalData === "number"
                    ? totalEvalData
                    : totalEvalData?.totalEvalAmount ?? 0;
            const totalProfit =
                typeof totalProfitData === "number"
                    ? totalProfitData
                    : totalProfitData?.totalProfit ?? 0;
            const profitRate =
                typeof profitRateData === "number"
                    ? profitRateData
                    : profitRateData?.totalProfitRate ?? 0;

            const cashBalance =
                typeof cashBalanceData === "number"
                    ? cashBalanceData
                    : cashBalanceData?.cashBalance ??
                    cashBalanceData?.cash_balance ??
                    0;

            const totalBuyAmount =
                typeof totalBuyAmountData === "number"
                    ? totalBuyAmountData
                    : totalBuyAmountData?.totalBuyAmount ??
                    totalBuyAmountData?.total_buy_amount ??
                    0;

            setSummary({
                totalAsset,
                totalEval,
                totalProfit,
                profitRate: (Number(profitRate) || 0).toFixed(2),
                cashBalance,
                totalBuyAmount,
            });

            const list = Array.isArray(portfolioData)
                ? portfolioData
                : portfolioData?.portfolioItemList ?? portfolioData?.portfolio ?? [];
            const formattedPortfolio = (list || []).map((p) => ({
                tradingPair: p.tradingPair || p.trading_pair || p.name || "UNKNOWN",
                percent: Number(p.percent ?? 0),
            }));
            setPortfolio(formattedPortfolio);
        } catch (e) {
            console.error("Wallet fetch error:", e);
        }
    };

    const fetchCoins = async () => {
        if (!token) return;

        try {
            const coinAssets = await getAllCoinAssets(token);
            const normalized = Array.isArray(coinAssets) ? coinAssets : [];

            // 디버깅: 첫 항목 구조 확인 (문제 해결 후 주석 처리 가능)
            if (normalized.length > 0) {
                console.debug("getAllCoinAssets sample:", normalized[0]);
            }

            setRawCoinAssets(normalized);

            const assetPromises = normalized.map(async (c) => {
                // 안전한 market/심볼 추출
                const market = extractMarket(c).trim();
                const coinSymbol = extractSymbol(c, market) || "";

                const [evalRes, profitRes] = await Promise.allSettled([
                    getCoinEvalAmount(token, market),
                    getCoinProfit(token, market),
                ]);

                const evalAmount = evalRes.status === "fulfilled" ? Number(evalRes.value) : 0;
                const profit = profitRes.status === "fulfilled" ? Number(profitRes.value) : 0;

                // buyAmount 필드명 차이 처리
                const buyAmount =
                    Number(c.buyAmount ?? c.buy_amount ?? c.buy_amount_krw ?? calcBuyAmount(c.coinBalance, c.avgBuyPrice)) || 0;

                const profitRate = buyAmount ? ((profit / buyAmount) * 100).toFixed(2) : "0.00";

                return {
                    market,
                    coinSymbol,
                    amount: Number(c.coinBalance ?? c.coin_balance ?? c.amount ?? 0),
                    avgPrice: Number(c.avgBuyPrice ?? c.avg_buy_price ?? c.avg_price ?? 0),
                    buyAmount,
                    evalAmount,
                    profit,
                    profitRate,
                };
            });

            setAssets(await Promise.all(assetPromises));
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
            alert("코인 삭제 실���");
        }
    };

    // filteredAssets for search (memoized)
    const filteredAssets = useMemo(() => {
        const q = coinFilter.trim().toUpperCase();
        if (!q) return assets;
        return assets.filter(
            (a) => a.market?.toUpperCase().includes(q) || a.coinSymbol?.toUpperCase().includes(q)
        );
    }, [assets, coinFilter]);

    // ---------- Render (minimal) ----------
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