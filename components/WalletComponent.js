import { useEffect, useState } from "react";
import {
    getTotalAssets,
    getTotalEvalAmount,
    getTotalProfit,
    getTotalProfitRate,
    getPortfolioAsset,
    getCoinEvalAmount,
    getCoinProfit
} from "../api/assetPriceStream";

import {
    addAsset,
    updateAsset,
    deleteAsset,
    getAssets,
    upsertCashBalance,
    getCashBalance,
} from "../api/krwAsset";

import {
    getAssetByTradingPair,
    getAssetByMarket,
    getAssetByKorean,
    getAssetByEnglish,
    getAssetByCategory,
    upsertCoinBuyAmount,
    getCoinBuyAmount,
    getTotalCoinBuyAmount,
} from "../api/coinAsset";

import {
    addFavoriteCoin,
    getFavoriteCoins,
    deleteFavoriteCoin,
    deleteAllFavoriteCoins,
} from "../api/favoriteCoin";

import { getAllMarkets } from "../api/tradingPair";
import { getStoredToken } from "../api/member";

export default function WalletComponent() {
    // ✅ 탭은 3개만: 보유자산 / 보유코인 / 포트폴리오
    const [activeTab, setActiveTab] = useState("myAssets");

    // ✅ 보유자산 탭 요약
    const [summary, setSummary] = useState({
        totalAsset: 0,
        totalEval: 0,
        totalProfit: 0,
        profitRate: 0,
        cashBalance: 0,
        totalBuyAmount: 0,
    });

    const [assets, setAssets] = useState([]);
    const [portfolio, setPortfolio] = useState([]);
    const [loading, setLoading] = useState(true);
    const [markets, setMarkets] = useState([]);
    const [favorites, setFavorites] = useState([]); // 유지(기존 fetchAll 영향 최소화)

    // ✅ 입력값들
    const [krwInput, setKrwInput] = useState("");

    const [coinInput, setCoinInput] = useState("");
    const [coinBalanceInput, setCoinBalanceInput] = useState("");

    const [selectedCoin, setSelectedCoin] = useState("");
    const [newCoinBalanceInput, setNewCoinBalanceInput] = useState("");

    const [buyAmountMarket, setBuyAmountMarket] = useState("");
    const [buyAmountInput, setBuyAmountInput] = useState("");

    const [searchText, setSearchText] = useState("");
    const [coinSearchResult, setCoinSearchResult] = useState([]);

    const token = typeof window !== "undefined" ? getStoredToken(localStorage.getItem("token")) : null;

    useEffect(() => {
        if (!token) return;
        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const fetchAll = async () => {
        setLoading(true);
        try {
            await Promise.all([
                fetchWalletData(),
                fetchCoins(),
                fetchMarkets(),
                fetchFavorites(), // 기존 그대로 (안 쓰면 나중에 제거 가능)
            ]);
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

            const totalAsset = totalAssetData?.totalAssets || totalAssetData?.total_assets || totalAssetData || 0;
            const totalEval = totalEvalData?.totalEvalAmount || totalEvalData?.total_eval_amount || totalEvalData || 0;
            const totalProfit = totalProfitData?.totalProfit || totalProfitData?.total_profit || totalProfitData || 0;
            const profitRate = profitRateData?.totalProfitRate || profitRateData?.total_profit_rate || profitRateData || 0;
            const cashBalance = cashBalanceData?.cashBalance || cashBalanceData?.cash_balance || cashBalanceData || 0;

            const totalBuyAmount =
                totalBuyAmountData?.totalBuyAmount ||
                totalBuyAmountData?.total_buy_amount ||
                totalBuyAmountData ||
                0;

            setSummary({
                totalAsset,
                totalEval,
                totalProfit,
                profitRate: (Number(profitRate) || 0).toFixed(2),
                cashBalance,
                totalBuyAmount,
            });

            const formattedPortfolio = (portfolioData || []).map((p) => ({
                tradingPair: p.tradingPair || p.trading_pair || p.name || "UNKNOWN",
                percent: Number(p.percent?.toFixed(2)) || 0,
            }));
            setPortfolio(formattedPortfolio);
        } catch (e) {
            console.error("Wallet fetch error:", e);
        }
    };

    const fetchCoins = async () => {
        if (!token) return;
        try {
            const coinAssetsRes = await getAssets(token);
            const coinAssets = Array.isArray(coinAssetsRes) ? coinAssetsRes : [];

            const assetPromises = coinAssets.map(async (c) => {
                const market = c.market;

                const [evalRes, profitRes, buyAmountRes] = await Promise.allSettled([
                    getCoinEvalAmount(token, market),
                    getCoinProfit(token, market),
                    getCoinBuyAmount(token, market),
                ]);

                const evalAmount = evalRes.status === "fulfilled" ? Number(evalRes.value) : 0;
                const profit = profitRes.status === "fulfilled" ? Number(profitRes.value) : 0;
                const buyAmount = buyAmountRes.status === "fulfilled" ? Number(buyAmountRes.value) : 0;

                const profitRate = buyAmount ? ((profit / buyAmount) * 100).toFixed(2) : "0.00";

                return {
                    tradingPair: market,
                    amount: Number(c.amount || 0),
                    buyAmount,
                    avgPrice: Number(c.avgPrice || 0),
                    evalAmount,
                    profit,
                    profitRate,
                };
            });

            setAssets(await Promise.all(assetPromises));
        } catch (e) {
            console.error("보유코인 데이터 가져오기 실패:", e);
            setAssets([]);
        }
    };

    const fetchMarkets = async () => {
        try {
            const data = await getAllMarkets();
            setMarkets(data.tradingPairs || data.trading_pairs || []);
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

    const handleAddKrw = async () => {
        if (!krwInput || isNaN(krwInput) || Number(krwInput) <= 0) {
            return alert("0보다 큰 금액을 입력하세요");
        }
        try {
            await upsertCashBalance(token, Number(krwInput));
            setKrwInput("");
            await fetchWalletData();
            alert("✅ KRW가 성공적으로 등록되었습니다!");
        } catch (e) {
            console.error(e);
            alert("❌ KRW 등록 실패: " + (e.response?.data?.message || e.message || "알 수 없는 오류"));
        }
    };

    const handleAddCoin = async () => {
        if (!coinInput || !coinBalanceInput || isNaN(coinBalanceInput)) {
            return alert("코인과 보유수량을 정확히 입력하세요");
        }
        try {
            await addAsset(token, { market: coinInput.toUpperCase(), amount: Number(coinBalanceInput) });
            setCoinInput("");
            setCoinBalanceInput("");
            await fetchCoins();
            await fetchWalletData();
        } catch (e) {
            console.error(e);
            alert("코인 등록 실패");
        }
    };

    const handleUpdateCoin = async () => {
        if (!selectedCoin || !newCoinBalanceInput || isNaN(newCoinBalanceInput)) {
            return alert("코인과 보유수량을 정확히 입력하세요");
        }
        try {
            await updateAsset(token, { market: selectedCoin, amount: Number(newCoinBalanceInput) });
            setSelectedCoin("");
            setNewCoinBalanceInput("");
            await fetchCoins();
            await fetchWalletData();
        } catch (e) {
            console.error(e);
            alert("��인 수정 실패");
        }
    };

    const handleDeleteCoin = async (market) => {
        if (!market) return;
        try {
            await deleteAsset(token, { market });
            await fetchCoins();
            await fetchWalletData();
        } catch (e) {
            console.error(e);
            alert("코인 삭제 실패");
        }
    };

    const handleUpsertBuyAmount = async () => {
        if (!buyAmountMarket || !buyAmountInput || isNaN(buyAmountInput) || Number(buyAmountInput) <= 0) {
            return alert("코인과 매수금액(0보다 큰 값)을 정확히 입력하세요");
        }
        try {
            await upsertCoinBuyAmount(token, buyAmountMarket, Number(buyAmountInput));
            setBuyAmountMarket("");
            setBuyAmountInput("");
            await fetchCoins();
            await fetchWalletData();
            alert("✅ 매수금액이 등록/수정되었습니다.");
        } catch (e) {
            console.error(e);
            alert("❌ 매수금액 등록 실패");
        }
    };

    const handleSearchCoin = async (text) => {
        if (!token || !text) return;

        try {
            const results = [];

            try {
                const r1 = await getAssetByTradingPair(text, token);
                if (r1) results.push(r1);
            } catch { }
            try {
                const r2 = await getAssetByMarket(text, token);
                if (r2) results.push(r2);
            } catch { }
            try {
                const r3 = await getAssetByKorean(text, token);
                if (r3) results.push(r3);
            } catch { }
            try {
                const r4 = await getAssetByEnglish(text, token);
                if (r4) results.push(r4);
            } catch { }

            const unique = results.reduce((acc, cur) => {
                if (!acc.find((item) => item.tradingPair === cur.tradingPair)) acc.push(cur);
                return acc;
            }, []);

            setCoinSearchResult(unique);
        } catch (e) {
            console.error(e);
            alert("코인 검색 실패");
        }
    };

    return (
        <div className="text-white">
            <h2 className="text-xl font-bold px-4 pt-4">Wallet</h2>

            {/* ✅ 상단 탭: 3개만 */}
            <div className="px-4 pt-3 border-b border-white/10 flex gap-7">
                <TopTab active={activeTab === "myAssets"} onClick={() => setActiveTab("myAssets")}>
                    보유자산
                </TopTab>
                <TopTab active={activeTab === "coins"} onClick={() => setActiveTab("coins")}>
                    보유코인
                </TopTab>
                <TopTab active={activeTab === "portfolio"} onClick={() => setActiveTab("portfolio")}>
                    포트폴리오
                </TopTab>
            </div>

            {/* body */}
            <div className="p-4 space-y-4">
                {loading && (
                    <div className="flex justify-center items-center py-20">
                        <div className="text-gray-400 text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                            <p>데이터를 불러오는 중...</p>
                        </div>
                    </div>
                )}

                {!loading && portfolio.length === 0 && assets.length === 0 && !summary.cashBalance && (
                    <div className="text-center text-gray-400 mt-10">현재 등록된 자산이 없습니다.</div>
                )}

                {!loading && activeTab === "myAssets" && (
                    <div className="space-y-4">
                        <section className="rounded-2xl bg-white/5 p-5 border border-white/5">
                            <div className="text-lg font-semibold flex items-center gap-2">
                                내 보유자산
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-6">
                                <div>
                                    <div className="text-sm text-white/60">보유 KRW</div>
                                    <div className="mt-2 text-4xl font-semibold tabular-nums">
                                        {Number(summary.cashBalance || 0).toLocaleString()}
                                    </div>
                                </div>

                                <div className="border-l border-white/10 pl-6">
                                    <div className="text-sm text-white/60">보유자산</div>
                                    <div className="mt-2 text-4xl font-semibold tabular-nums">
                                        {Number(summary.totalAsset || 0).toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            {/* ✅ 여기 수정: 평가손익/수익률 줄맞춤 */}
                            <div className="mt-6 grid grid-cols-2 gap-x-10 gap-y-3 text-sm">
                                <MetricRow label="총 매수" value={`${Number(summary.totalBuyAmount || 0).toLocaleString()} KRW`} />
                                <MetricRow
                                    label="평가손익"
                                    value={`${Number(summary.totalProfit || 0).toLocaleString()} KRW`}
                                    valueClass={Number(summary.totalProfit || 0) >= 0 ? "text-red-400" : "text-blue-400"}
                                />
                                <MetricRow label="총 평가" value={`${Number(summary.totalEval || 0).toLocaleString()} KRW`} />
                                <MetricRow
                                    label="수익률"
                                    value={`${Number(summary.profitRate || 0).toLocaleString()}%`}
                                    valueClass={Number(summary.profitRate || 0) >= 0 ? "text-red-400" : "text-blue-400"}
                                />
                                <MetricRow label="주문가능" value={`${Number(summary.cashBalance || 0).toLocaleString()} KRW`} />
                                <div />
                            </div>
                        </section>

                        <section className="rounded-2xl bg-white/5 p-5 border border-white/5">
                            <div className="text-sm font-semibold mb-3">보유 현금 (KRW) 등록/수정</div>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={krwInput}
                                    onChange={(e) => setKrwInput(e.target.value)}
                                    placeholder="보유 KRW 금액 입력"
                                    className="px-3 py-2 rounded-lg bg-white/10 flex-1"
                                    min="0"
                                />
                                <button
                                    onClick={handleAddKrw}
                                    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg font-semibold transition"
                                >
                                    등록/수정
                                </button>
                            </div>
                            <div className="mt-3 text-sm text-white/70">
                                현재 보유: <span className="font-bold text-white">{Number(summary.cashBalance || 0).toLocaleString()}원</span>
                            </div>
                        </section>
                    </div>
                )}

                {!loading && activeTab === "coins" && (
                    <div className="space-y-4">
                        <section className="rounded-2xl bg-white/5 p-5 border border-white/5">
                            <div className="text-sm font-semibold mb-3">코인 등록/수정</div>

                            <div className="flex flex-wrap gap-2 mb-4">
                                <select
                                    value={coinInput}
                                    onChange={(e) => setCoinInput(e.target.value)}
                                    className="px-3 py-2 rounded bg-white/10"
                                >
                                    <option value="">코인 선택</option>
                                    {markets.map((m) => (
                                        <option key={m.market} value={m.market}>
                                            {m.market}({m.korean_name})
                                        </option>
                                    ))}
                                </select>

                                <input
                                    type="number"
                                    value={coinBalanceInput}
                                    onChange={(e) => setCoinBalanceInput(e.target.value)}
                                    placeholder="보유 수량"
                                    className="px-3 py-2 rounded bg-white/10"
                                />

                                <button onClick={handleAddCoin} className="px-4 py-2 bg-indigo-500 rounded font-semibold">
                                    코인 등록
                                </button>
                            </div>

                            <div className="flex flex-wrap gap-2 mb-4">
                                <select
                                    value={selectedCoin}
                                    onChange={(e) => setSelectedCoin(e.target.value)}
                                    className="px-3 py-2 rounded bg-white/10"
                                >
                                    <option value="">수정할 코인 선택</option>
                                    {assets.map((c) => (
                                        <option key={c.tradingPair} value={c.tradingPair}>
                                            {c.tradingPair}
                                        </option>
                                    ))}
                                </select>

                                <input
                                    type="number"
                                    value={newCoinBalanceInput}
                                    onChange={(e) => setNewCoinBalanceInput(e.target.value)}
                                    placeholder="새 보유 수량"
                                    className="px-3 py-2 rounded bg-white/10"
                                />

                                <button onClick={handleUpdateCoin} className="px-4 py-2 bg-green-600 rounded font-semibold">
                                    수정
                                </button>

                                {selectedCoin && (
                                    <button onClick={() => handleDeleteCoin(selectedCoin)} className="px-4 py-2 bg-red-600 rounded font-semibold">
                                        삭제
                                    </button>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <select
                                    value={buyAmountMarket}
                                    onChange={(e) => setBuyAmountMarket(e.target.value)}
                                    className="px-3 py-2 rounded bg-white/10"
                                >
                                    <option value="">매수금액 입력할 코인 선택</option>
                                    {assets.map((c) => (
                                        <option key={c.tradingPair} value={c.tradingPair}>
                                            {c.tradingPair}
                                        </option>
                                    ))}
                                </select>

                                <input
                                    type="number"
                                    value={buyAmountInput}
                                    onChange={(e) => setBuyAmountInput(e.target.value)}
                                    placeholder="매수금액(원)"
                                    className="px-3 py-2 rounded bg-white/10"
                                />

                                <button onClick={handleUpsertBuyAmount} className="px-4 py-2 bg-indigo-500 rounded font-semibold">
                                    매수금액 등록/수정
                                </button>
                            </div>
                        </section>

                        {/* ✅ 보유코인 리스트 */}
                        <section className="space-y-3">
                            {assets.length === 0 && <div className="text-white/50 text-sm">보유 코인이 없습니다.</div>}
                            {assets.map((coin) => (
                                <CoinCard key={coin.tradingPair} coin={coin} />
                            ))}
                        </section>
                    </div>
                )}

                {!loading && activeTab === "portfolio" && (
                    <section className="rounded-2xl bg-white/5 p-5 border border-white/5">
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                            <div className="flex justify-center">
                                <div className="h-56 w-56 rounded-full border border-white/10 flex items-center justify-center text-white/60">
                                    도넛차트 자리
                                </div>
                            </div>

                            <div className="space-y-3">
                                {portfolio.map((p) => (
                                    <div key={p.tradingPair} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="h-3 w-3 rounded-full bg-green-400/80" />
                                            <span className="font-medium">{p.tradingPair}</span>
                                        </div>
                                        <div className="tabular-nums text-white/80">{Number(p.percent || 0).toFixed(1)}%</div>
                                    </div>
                                ))}
                                {portfolio.length === 0 && <div className="text-white/50 text-sm">포트폴리오 데이터가 없습니다.</div>}
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}

function TopTab({ active, children, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`pb-3 text-base transition ${
                active ? "border-b-2 border-white font-semibold text-white" : "text-white/70 hover:text-white"
            }`}
        >
            {children}
        </button>
    );
}

/**
 * ✅ 여기 수정: 라벨폭 고정 + 값 오른쪽 정렬로 줄 맞���
 */
function MetricRow({ label, value, valueClass = "text-white" }) {
    return (
        <div className="grid grid-cols-[88px_1fr] items-center">
            <span className="text-white/60">{label}</span>
            <span className={`tabular-nums text-right ${valueClass}`}>{value}</span>
        </div>
    );
}

/**
 * ✅ 스샷처럼 보이도록 보유코인 카드형 UI
 */
function CoinCard({ coin }) {
    const profitNum = Number(coin.profit || 0);
    const profitRateNum = Number(coin.profitRate || 0);

    const profitColor = profitNum >= 0 ? "text-red-400" : "text-blue-400";
    const rateColor = profitRateNum >= 0 ? "text-red-400" : "text-blue-400";

    return (
        <div className="rounded-2xl bg-white/5 border border-white/5 overflow-hidden">
            <div className="px-5 pt-5 pb-4">
                <div className="flex items-start justify-between">
                    <div className="text-xl font-semibold">{coin.tradingPair}</div>

                    <div className="text-right">
                        <div className="text-xs text-white/50">평가손익</div>
                        <div className={`text-xl font-semibold tabular-nums ${profitColor}`}>
                            {profitNum.toLocaleString()}
                        </div>

                        <div className="mt-1 text-xs text-white/50">수익률</div>
                        <div className={`text-lg tabular-nums ${rateColor}`}>
                            {profitRateNum.toFixed(2)}%
                        </div>
                    </div>
                </div>
            </div>

            <div className="h-px bg-white/10" />

            <div className="p-5 grid grid-cols-2 gap-y-5">
                <StatBlock label="보유수량" value={`${Number(coin.amount || 0)}`} />
                <StatBlock label="매수평균가" value={`${Number(coin.avgPrice || 0).toLocaleString()} KRW`} />
                <StatBlock label="평가금액" value={`${Number(coin.evalAmount || 0).toLocaleString()} KRW`} />
                <StatBlock label="매수금액" value={`${Number(coin.buyAmount || 0).toLocaleString()} KRW`} />
            </div>
        </div>
    );
}

function StatBlock({ label, value }) {
    return (
        <div className="text-center">
            <div className="text-xs text-white/50">{label}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
        </div>
    );
}