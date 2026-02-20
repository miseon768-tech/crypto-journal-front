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
    const [activeTab, setActiveTab] = useState("myAssets");

    // ✅ 보유자산 탭 요약
    const [summary, setSummary] = useState({
        totalAsset: 0,      // 총 보유자산
        totalEval: 0,       // 총 평가
        totalProfit: 0,     // 평가손익
        profitRate: 0,      // 수익률
        cashBalance: 0,     // 보유KRW(=주문가능)
        totalBuyAmount: 0,  // 총 매수
    });

    const [assets, setAssets] = useState([]);
    const [portfolio, setPortfolio] = useState([]);
    const [loading, setLoading] = useState(true);
    const [markets, setMarkets] = useState([]);
    const [favorites, setFavorites] = useState([]);

    // ✅ 입력값들
    const [krwInput, setKrwInput] = useState("");

    const [coinInput, setCoinInput] = useState("");
    const [coinBalanceInput, setCoinBalanceInput] = useState(""); // ✅ (기존 coinAmount 대체) 보유수량 입력

    const [selectedCoin, setSelectedCoin] = useState("");
    const [newCoinBalanceInput, setNewCoinBalanceInput] = useState(""); // ✅ (기존 newCoinAmount 대체) 새 보유수량

    // ✅ 코인별 매수금액 등록/수정 UI
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
                fetchFavorites(),
            ]);
        } finally {
            setLoading(false);
        }
    };

    // ===== 전체 자산 fetch =====
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

    // ===== 보유코인 fetch =====
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

                // ✅ 수익률: 매수금액 대비 손익
                const profitRate = buyAmount ? ((profit / buyAmount) * 100).toFixed(2) : "0.00";

                return {
                    tradingPair: market,
                    amount: Number(c.amount || 0),       // 보유수량
                    buyAmount,                            // 매수금액
                    avgPrice: Number(c.avgPrice || 0),    // 매수평균가
                    evalAmount,                           // 평가금액
                    profit,                               // 평가손익
                    profitRate,                            // 수익률
                };
            });

            setAssets(await Promise.all(assetPromises));
        } catch (e) {
            console.error("보유코인 데이터 가져오기 실패:", e);
            setAssets([]);
        }
    };

    // ===== 마켓 fetch =====
    const fetchMarkets = async () => {
        try {
            const data = await getAllMarkets();
            setMarkets(data.tradingPairs || data.trading_pairs || []);
        } catch (e) {
            console.error("마켓 불러오기 실패:", e);
        }
    };

    // ===== 관심 코인 fetch =====
    const fetchFavorites = async () => {
        if (!token) return;
        try {
            const data = await getFavoriteCoins(token);
            setFavorites(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error("관심 코인 불러오기 실패:", e);
        }
    };

    // ===== KRW 등록 =====
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

    // ===== 코인 등록 (보유수량 기준) =====
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

    // ===== 코인 보유수량 수정 =====
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
            alert("코인 수정 실패");
        }
    };

    // ===== 코인 삭제 =====
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

    // ===== 코인별 매수금액 등록/수정 =====
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

    // ===== 관심 코인 등록 =====
    const handleAddFavorite = async (market) => {
        if (!market) return;
        try {
            await addFavoriteCoin({ tradingPairId: market }, token);
            fetchFavorites();
        } catch (e) {
            console.error(e);
            alert("관심 코인 추가 실패");
        }
    };

    // ===== 관심 코인 삭제 =====
    const handleDeleteFavorite = async (market) => {
        if (!market) return;
        try {
            await deleteFavoriteCoin({ tradingPairId: market }, token);
            fetchFavorites();
        } catch (e) {
            console.error(e);
            alert("관심 코인 삭제 실패");
        }
    };

    // ===== 관심 코인 전체 삭제 =====
    const handleDeleteAllFavorites = async () => {
        try {
            await deleteAllFavoriteCoins(token);
            setFavorites([]);
        } catch (e) {
            console.error(e);
            alert("전체 관심 코인 삭제 실패");
        }
    };

    // ===== 코인 검색 =====
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
        <div className="space-y-6">
            <h2 className="text-xl font-bold mb-2">Wallet</h2>

            {/* 탭 버튼 */}
            <div className="flex gap-4 mb-4">
                <TabButton active={activeTab === "myAssets"} onClick={() => setActiveTab("myAssets")}>보유자산</TabButton>
                <TabButton active={activeTab === "coins"} onClick={() => setActiveTab("coins")}>보유코인</TabButton>
                <TabButton active={activeTab === "portfolio"} onClick={() => setActiveTab("portfolio")}>포트폴리오</TabButton>
                <TabButton active={activeTab === "favorites"} onClick={() => setActiveTab("favorites")}>관심코인</TabButton>
            </div>

            {/* 로딩 */}
            {loading && (
                <div className="flex justify-center items-center py-20">
                    <div className="text-gray-400 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                        <p>데이터를 불러오는 중...</p>
                    </div>
                </div>
            )}

            {/* 빈 자산 메시지 */}
            {!loading && portfolio.length === 0 && assets.length === 0 && favorites.length === 0 && !summary.cashBalance && (
                <div className="text-center text-gray-400 mt-10">현재 등록된 자산이 없습니다.</div>
            )}

            {!loading && (
                <>
                    {/* 보유자산 탭 */}
                    {activeTab === "myAssets" && (
                        <div className="space-y-4">
                            {/* KRW 입력 섹션 */}
                            <div className="bg-white/5 p-4 rounded-xl">
                                <h3 className="text-sm font-semibold mb-3">💰 보유 현금 (KRW)</h3>
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
                                <div className="mt-3 text-sm text-gray-300">
                                    현재 보유: <span className="font-bold text-white">{Number(summary.cashBalance || 0).toLocaleString()}원</span>
                                </div>
                            </div>

                            {/* 자산 요약 카드 */}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                <Card title="보유 KRW" value={summary.cashBalance} suffix="원" />
                                <Card title="총 매수" value={summary.totalBuyAmount} suffix="원" />
                                <Card title="총 평가" value={summary.totalEval} suffix="원" />
                                <Card title="주문가능금액" value={summary.cashBalance} suffix="원" />
                                <Card title="총 보유자산" value={summary.totalAsset} suffix="원" />
                                <Card title="평가손익" value={summary.totalProfit} suffix="원" isProfit />
                                <Card title="수익률" value={summary.profitRate} suffix="%" isProfit />
                            </div>
                        </div>
                    )}

                    {/* 포트폴리오 탭 */}
                    {activeTab === "portfolio" && (
                        <div className="space-y-2 border-t border-white/10 pt-2">
                            {portfolio.map((p) => (
                                <div key={p.tradingPair} className="mb-2">
                                    <div className="flex justify-between text-sm mb-1">
                                        <span>{p.tradingPair}</span>
                                        <span>{p.percent}%</span>
                                    </div>
                                    <div className="h-2 bg-gray-700 rounded">
                                        <div className="h-2 bg-indigo-400 rounded" style={{ width: `${p.percent}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 보유코인 탭 */}
                    {activeTab === "coins" && (
                        <div className="space-y-4">
                            {/* ✅ 코인 등록: 보유수량 */}
                            <div className="flex gap-2 mb-4">
                                <select
                                    value={coinInput}
                                    onChange={(e) => setCoinInput(e.target.value)}
                                    className="px-2 py-1 rounded bg-white/10"
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
                                    className="px-2 py-1 rounded bg-white/10"
                                />

                                <button onClick={handleAddCoin} className="px-3 py-1 bg-indigo-500 rounded">
                                    코인 등록
                                </button>
                            </div>

                            {/* ✅ 코인 보유수량 수정 */}
                            <div className="flex gap-2 mb-4">
                                <select
                                    value={selectedCoin}
                                    onChange={(e) => setSelectedCoin(e.target.value)}
                                    className="px-2 py-1 rounded bg-white/20"
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
                                    className="px-2 py-1 rounded bg-white/20"
                                />

                                <button onClick={handleUpdateCoin} className="px-3 py-1 bg-green-500 rounded">
                                    수정
                                </button>

                                {selectedCoin && (
                                    <button onClick={() => handleDeleteCoin(selectedCoin)} className="px-3 py-1 bg-red-500 rounded">
                                        삭제
                                    </button>
                                )}
                            </div>

                            {/* ✅ 코인별 매수금액 등록/수정 */}
                            <div className="flex gap-2 mb-4">
                                <select
                                    value={buyAmountMarket}
                                    onChange={(e) => setBuyAmountMarket(e.target.value)}
                                    className="px-2 py-1 rounded bg-white/10"
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
                                    className="px-2 py-1 rounded bg-white/10"
                                />

                                <button onClick={handleUpsertBuyAmount} className="px-3 py-1 bg-indigo-500 rounded">
                                    매수금액 등록/수정
                                </button>
                            </div>

                            {assets.length === 0 && <div className="text-gray-400 text-sm">보유 코인이 없습니다.</div>}

                            {assets.length > 0 && (
                                <table className="w-full text-sm text-left">
                                    <thead>
                                    <tr className="border-b border-white/20">
                                        <th className="px-2 py-1">코인</th>
                                        <th className="px-2 py-1">보유수량</th>
                                        <th className="px-2 py-1">평가금액</th>
                                        <th className="px-2 py-1">평가손익</th>
                                        <th className="px-2 py-1">수익률 (%)</th>
                                        <th className="px-2 py-1">매수평균가</th>
                                        <th className="px-2 py-1">매수금액</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {assets.map((coin) => (
                                        <tr key={coin.tradingPair} className="border-b border-white/10">
                                            <td className="px-2 py-1">{coin.tradingPair}</td>
                                            <td className="px-2 py-1">{coin.amount || 0}</td>
                                            <td className="px-2 py-1">{coin.evalAmount?.toLocaleString() || 0}원</td>
                                            <td className="px-2 py-1">{coin.profit?.toLocaleString() || 0}원</td>
                                            <td className="px-2 py-1">{coin.profitRate}%</td>
                                            <td className="px-2 py-1">{coin.avgPrice?.toLocaleString() || 0}원</td>
                                            <td className="px-2 py-1">{coin.buyAmount?.toLocaleString() || 0}원</td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {/* 관심코인 탭 */}
                    {activeTab === "favorites" && (
                        <div className="space-y-4">
                            <div className="flex gap-2 mb-4">
                                <input
                                    type="text"
                                    placeholder="코인명, 트레이딩페어, 마켓 등"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    className="px-2 py-1 rounded bg-white/10 flex-1"
                                />
                                <button onClick={() => handleSearchCoin(searchText)} className="px-3 py-1 bg-indigo-500 rounded">
                                    검색
                                </button>
                            </div>

                            {coinSearchResult.length > 0 && (
                                <div className="mb-2">
                                    <h4>검색 결과</h4>
                                    <ul className="space-y-1">
                                        {coinSearchResult.map((c) => (
                                            <li key={c.tradingPair} className="bg-white/10 p-2 rounded flex justify-between items-center">
                                                <span>{c.tradingPair} ({c.market})</span>
                                                <button
                                                    onClick={() => handleAddFavorite(c.tradingPair)}
                                                    className="px-2 py-1 bg-green-500 rounded text-sm"
                                                >
                                                    관심코인 추가
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {favorites.length === 0 && <div className="text-gray-400 text-sm">관심 코인이 없습니다.</div>}
                            {favorites.length > 0 && (
                                <>
                                    <ul className="space-y-2">
                                        {favorites.map((f) => (
                                            <li key={f.tradingPair} className="flex justify-between items-center bg-white/10 p-2 rounded">
                                                <span>{f.tradingPair}</span>
                                                <button
                                                    onClick={() => handleDeleteFavorite(f.tradingPair)}
                                                    className="px-2 py-1 bg-red-500 rounded text-sm"
                                                >
                                                    삭제
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                    <button onClick={handleDeleteAllFavorites} className="px-3 py-1 bg-red-700 rounded mt-2">
                                        전체 삭제
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function Card({ title, value, suffix = "", isProfit = false }) {
    const numValue = Number(value) || 0;
    const isPositive = numValue >= 0;
    const colorClass = isProfit ? (isPositive ? "text-green-400" : "text-red-400") : "text-white";

    return (
        <div className="bg-white/10 p-4 rounded-xl text-center hover:bg-white/15 transition">
            <div className="text-sm text-gray-400 mb-1">{title}</div>
            <div className={`text-xl font-bold mt-2 ${colorClass}`}>
                {isProfit && numValue > 0 && "+"}
                {numValue.toLocaleString()}
                {suffix && <span className="text-sm ml-1">{suffix}</span>}
            </div>
        </div>
    );
}

function TabButton({ active, children, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`px-5 py-2 rounded-lg font-semibold transition ${
                active ? "bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.6)]" : "bg-white/10 hover:bg-white/20"
            }`}
        >
            {children}
        </button>
    );
}