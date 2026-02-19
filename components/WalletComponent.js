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
    upsertCashBalance,
    getCashBalance,
} from "../api/krwAsset";

import {
    getAllCoinAssets,      // 🔥 새로 추가
    createCoinAsset,       // 🔥 새로 추가
    deleteCoinAsset,       // 🔥 새로 추가
    getAssetByMarket,
    getAssetByKorean,
    getAssetByEnglish,
    upsertCoinBuyAmount,
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
    const [summary, setSummary] = useState({
        totalAssets: 0,
        totalEvalAmount: 0,
        totalProfit: 0,
        totalProfitRate: 0,
        cashBalance: 0
    });
    const [assets, setAssets] = useState([]);
    const [portfolio, setPortfolio] = useState([]);
    const [loading, setLoading] = useState(true);
    const [markets, setMarkets] = useState([]);
    const [favorites, setFavorites] = useState([]);

    const [krwInput, setKrwInput] = useState("");
    const [krwBalance, setKrwBalance] = useState(0);

    const [coinInput, setCoinInput] = useState("");
    const [coinAmount, setCoinAmount] = useState("");
    const [selectedCoin, setSelectedCoin] = useState("");
    const [newCoinAmount, setNewCoinAmount] = useState("");
    const [searchText, setSearchText] = useState("");
    const [coinSearchResult, setCoinSearchResult] = useState([]);

    const token = typeof window !== "undefined" ? getStoredToken(localStorage.getItem("token")) : null;

    useEffect(() => {
        if (!token) return;
        fetchWalletData();
        fetchCoins();
        fetchMarkets();
        fetchFavorites();
        fetchKrwBalance();
    }, [token]);

    // ===== 전체 자산 fetch =====
    const fetchWalletData = async () => {
        setLoading(true);
        try {
            const results = await Promise.allSettled([
                getTotalAssets(token),
                getTotalEvalAmount(token),
                getTotalProfit(token),
                getTotalProfitRate(token),
                getPortfolioAsset(token),
                getCashBalance(token),
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
            const cashBalance = getValue(5, 0);

            setSummary({
                totalAssets: totalAsset || 0,
                totalEvalAmount: totalEval || 0,
                totalProfit: totalProfit || 0,
                totalProfitRate: Number(profitRate) || 0,
                cashBalance: cashBalance || 0
            });

            const formattedPortfolio = (portfolioData || []).map(p => ({
                tradingPair: p.name || p.tradingPair || "UNKNOWN",
                valuation: p.valuation || 0,
                percent: Number(p.percent?.toFixed(2)) || 0,
            }));
            setPortfolio(formattedPortfolio);
        } catch (e) {
            console.error("Wallet fetch error:", e);
        } finally {
            setLoading(false);
        }
    };

    // ===== 🔥 보유코인 fetch (수정) =====
    // ===== 보유코인 fetch =====
    const fetchCoins = async () => {
        console.log("🔵 [fetchCoins] 시작");
        console.log("🔵 [fetchCoins] 토큰 존재:", !!token);

        if (!token) {
            console.log("⚠️ [fetchCoins] 토큰 없음");
            return;
        }

        try {
            console.log("🔵 [fetchCoins] getAllCoinAssets 호출 중...");
            const coinAssets = await getAllCoinAssets(token);

            console.log("✅ [fetchCoins] 코인 자산 조회 성공");
            console.log("✅ [fetchCoins] 자산 타입:", Array.isArray(coinAssets) ? "배열" : typeof coinAssets);
            console.log("✅ [fetchCoins] 자산 개수:", coinAssets?.length);
            console.log("✅ [fetchCoins] 자산 데이터:", coinAssets);

            if (!Array.isArray(coinAssets) || coinAssets.length === 0) {
                console.log("⚠️ [fetchCoins] 보유 코인 없음");
                setAssets([]);
                return;
            }

            console.log("🔵 [fetchCoins] 자산별 상세 정보 조회 시작...");

            const assetPromises = coinAssets.map(async (coinAsset, index) => {
                console.log(`🔵 [fetchCoins] 자산 ${index + 1} 처리:`, coinAsset);

                const market = coinAsset.market;

                if (!market) {
                    console.warn(`⚠️ [fetchCoins] 자산 ${index + 1} Market 정보 없음:`, coinAsset);
                    return null;
                }

                try {
                    console.log(`🔵 [fetchCoins] ${market} 평가금액/손익 조회 중...`);

                    const [evalRes, profitRes] = await Promise.allSettled([
                        getCoinEvalAmount(token, market),
                        getCoinProfit(token, market),
                    ]);

                    const evalAmount = evalRes.status === "fulfilled" ? evalRes.value : 0;
                    const profit = profitRes.status === "fulfilled" ? profitRes.value : 0;
                    const buyAmount = coinAsset.buyAmount || 0;

                    console.log(`✅ [fetchCoins] ${market} 데이터:`, {
                        evalAmount,
                        profit,
                        buyAmount
                    });

                    const profitRate = buyAmount > 0
                        ? ((profit / buyAmount) * 100).toFixed(2)
                        : '0.00';

                    return {
                        id: coinAsset.id,
                        tradingPair: market,
                        koreanName: coinAsset.koreanName,
                        englishName: coinAsset.englishName,
                        amount: coinAsset.coinBalance || 0,
                        buyAmount: buyAmount,
                        avgPrice: coinAsset.avgBuyPrice || 0,
                        evalAmount: evalAmount,
                        profit: profit,
                        profitRate: profitRate,
                    };
                } catch (err) {
                    console.error(`❌ [fetchCoins] ${market} 데이터 조회 실패:`, err);
                    return {
                        id: coinAsset.id,
                        tradingPair: market,
                        koreanName: coinAsset.koreanName,
                        englishName: coinAsset.englishName,
                        amount: coinAsset.coinBalance || 0,
                        buyAmount: coinAsset.buyAmount || 0,
                        avgPrice: coinAsset.avgBuyPrice || 0,
                        evalAmount: 0,
                        profit: 0,
                        profitRate: '0.00',
                    };
                }
            });

            const results = await Promise.all(assetPromises);
            const validAssets = results.filter(item => item !== null);

            console.log("✅ [fetchCoins] 최종 자산 개수:", validAssets.length);
            console.log("✅ [fetchCoins] 최종 자산 데이터:", validAssets);

            setAssets(validAssets);
        } catch (e) {
            console.error("❌ [fetchCoins] 최종 에러:", e);
            console.error("❌ [fetchCoins] 에러 메시지:", e.message);
            console.error("❌ [fetchCoins] 에러 스택:", e.stack);
            setAssets([]);
        }
    };

    // ===== 마켓 fetch =====
    const fetchMarkets = async () => {
        try {
            const data = await getAllMarkets();
            const marketList = data?.markets || data?.tradingPairs || data?.trading_pairs || data || [];
            setMarkets(Array.isArray(marketList) ? marketList : []);
        } catch (e) {
            console.error("마켓 불러오기 실패:", e);
            setMarkets([]);
        }
    };

    // ===== 관심 코인 fetch =====
    const fetchFavorites = async () => {
        if (!token) return;
        try {
            const data = await getFavoriteCoins(token);
            const favoriteList = data?.favoriteCoinList || data || [];
            setFavorites(Array.isArray(favoriteList) ? favoriteList : []);
        } catch (e) {
            console.error("관심 코인 불러오기 실패:", e);
            setFavorites([]);
        }
    };

    // ===== KRW 잔고 fetch =====
    const fetchKrwBalance = async () => {
        if (!token) return;
        try {
            const balance = await getCashBalance(token);
            setKrwBalance(Number(balance) || 0);
        } catch (e) {
            console.error("KRW 잔고 조회 실패:", e);
            setKrwBalance(0);
        }
    };

    // ===== KRW 등록/수정 =====
    const handleAddKrw = async () => {
        const amount = Number(krwInput);

        if (!krwInput || isNaN(amount) || amount <= 0) {
            alert("금액은 0보다 큰 숫자여야 합니다");
            return;
        }

        try {
            await upsertCashBalance(token, amount);
            setKrwInput("");
            await fetchKrwBalance();
            await fetchWalletData();
            alert("KRW 등록 완료");
        } catch (e) {
            console.error("KRW 등록 실패:", e);
            alert(e.message || "KRW 등록 실패");
        }
    };

    // ===== 🔥 코인 자산 추가 (수정) =====
    const handleAddCoin = async () => {
        const amount = Number(coinAmount);

        if (!coinInput || !coinAmount || isNaN(amount) || amount <= 0) {
            alert("코인과 금액을 정확히 입력하세요 (0보다 큰 금액)");
            return;
        }

        try {
            // 백엔드: POST /api/coin/assets
            // CreateCoinAssetRequest { market, buyAmount }
            await createCoinAsset(coinInput, amount, token);

            setCoinInput("");
            setCoinAmount("");
            await fetchCoins();
            await fetchWalletData();
            alert("코인 자산 등록 완료");
        } catch (e) {
            console.error("코인 등록 실패:", e);
            alert(e.message || "코인 등록 실패");
        }
    };

    // ===== 🔥 코인 자산 수정 (수정) =====
    const handleUpdateCoin = async () => {
        const amount = Number(newCoinAmount);

        if (!selectedCoin || !newCoinAmount || isNaN(amount) || amount <= 0) {
            alert("코인과 금액을 정확히 입력하세요");
            return;
        }

        try {
            // 백엔드: POST /api/coin/assets/purchase-by-coin
            // UpdateCoinBuyAmountRequest { market, amount }
            await upsertCoinBuyAmount(selectedCoin, amount, token);

            setSelectedCoin("");
            setNewCoinAmount("");
            await fetchCoins();
            await fetchWalletData();
            alert("코인 매수 금액 수정 완료");
        } catch (e) {
            console.error("코인 수정 실패:", e);
            alert(e.message || "코인 수정 실패");
        }
    };

    // ===== 🔥 코인 자산 삭제 (수정) =====
    const handleDeleteCoin = async (assetId) => {
        if (!assetId) return;

        const asset = assets.find(a => a.id === assetId);
        const coinName = asset ? asset.tradingPair : assetId;

        if (!confirm(`${coinName} 자산을 삭제하시겠습니까?`)) return;

        try {
            // 백엔드: DELETE /api/coin/assets/{assetId}
            await deleteCoinAsset(assetId, token);
            await fetchCoins();
            await fetchWalletData();
            alert("코인 자산 삭제 완료");
        } catch (e) {
            console.error("코인 삭제 실패:", e);
            alert(e.message || "코인 삭제 실패");
        }
    };

    // ===== 관심 코인 등록 =====
    const handleAddFavorite = async (coinInput) => {
        if (!coinInput) return;

        try {
            await addFavoriteCoin(coinInput, token);
            await fetchFavorites();
            alert("관심 코인 추가 완료");
        } catch (e) {
            console.error("관심 코인 추가 실패:", e);
            alert(e.message || "관심 코인 추가 실패");
        }
    };

    // ===== 관심 코인 선택 삭제 =====
    const handleDeleteFavorite = async (tradingPairId) => {
        if (!tradingPairId) return;

        try {
            await deleteFavoriteCoin([tradingPairId], token);
            await fetchFavorites();
            alert("관심 코인 삭제 완료");
        } catch (e) {
            console.error("관심 코인 삭제 실패:", e);
            alert(e.message || "관심 코인 삭제 실패");
        }
    };

    // ===== 관심 코인 전체 삭제 =====
    const handleDeleteAllFavorites = async () => {
        if (!confirm("모든 관심 코인을 삭제하시겠습니까?")) return;

        try {
            await deleteAllFavoriteCoins(token);
            setFavorites([]);
            alert("전체 관심 코인 삭제 완료");
        } catch (e) {
            console.error("전체 관심 코인 삭제 실패:", e);
            alert(e.message || "전체 관심 코인 삭제 실패");
        }
    };

    // ===== 코인 검색 (통합) =====
    const handleSearchCoin = async (text) => {
        if (!token || !text) {
            alert("검색어를 입력하세요");
            return;
        }

        try {
            const results = [];
            const searchMethods = [
                { fn: getAssetByMarket, param: text },
                { fn: getAssetByKorean, param: text },
                { fn: getAssetByEnglish, param: text },
            ];

            for (const method of searchMethods) {
                try {
                    const result = await method.fn(method.param, token);

                    if (result) {
                        const assetList = result.coinAssetList || result;

                        if (Array.isArray(assetList) && assetList.length > 0) {
                            assetList.forEach(asset => {
                                const market = asset.tradingPair?.market || asset.market;
                                const koreanName = asset.tradingPair?.koreanName || asset.koreanName;
                                const englishName = asset.tradingPair?.englishName || asset.englishName;

                                if (market && !results.find(r => r.market === market)) {
                                    results.push({
                                        market: market,
                                        koreanName: koreanName || "",
                                        englishName: englishName || "",
                                        tradingPairId: asset.tradingPair?.id || asset.id,
                                    });
                                }
                            });
                        }
                    }
                } catch (err) {
                    // 검색 결과 없음 - 무시
                }
            }

            if (results.length === 0) {
                alert("검색 결과가 없습니다");
            }

            setCoinSearchResult(results);
        } catch (e) {
            console.error("코인 검색 실패:", e);
            alert("코인 검색 실패");
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold mb-2">Wallet</h2>

            {/* 탭 버튼 */}
            <div className="flex gap-4 mb-4">
                <TabButton active={activeTab === "myAssets"} onClick={() => setActiveTab("myAssets")}>
                    보유자산
                </TabButton>
                <TabButton active={activeTab === "coins"} onClick={() => setActiveTab("coins")}>
                    보유코인
                </TabButton>
                <TabButton active={activeTab === "portfolio"} onClick={() => setActiveTab("portfolio")}>
                    포트폴리오
                </TabButton>
                <TabButton active={activeTab === "favorites"} onClick={() => setActiveTab("favorites")}>
                    관심코인
                </TabButton>
            </div>

            {loading && <div className="text-center py-10">데이터를 불러오는 중...</div>}

            {!loading && portfolio.length === 0 && assets.length === 0 && favorites.length === 0 && (
                <div className="text-center text-gray-400 mt-10">현재 등록된 자산이 없습니다.</div>
            )}

            {!loading && (
                <>
                    {/* ========== 보유자산 탭 ========== */}
                    {activeTab === "myAssets" && (
                        <div className="space-y-8">
                            {/* KRW 영역 */}
                            <div className="bg-white/5 p-4 rounded-xl">
                                <div className="text-sm text-gray-400 mb-2">주문 가능 금액 (보유 KRW)</div>
                                <div className="text-2xl font-bold mb-3">
                                    {krwBalance.toLocaleString()} 원
                                </div>

                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        value={krwInput}
                                        onChange={e => setKrwInput(e.target.value)}
                                        placeholder="KRW 금액 입력"
                                        className="px-3 py-2 rounded bg-black/40 w-48 text-white"
                                        min="1"
                                    />
                                    <button
                                        onClick={handleAddKrw}
                                        className="px-4 py-2 bg-indigo-500 rounded hover:bg-indigo-600 transition"
                                    >
                                        등록/수정
                                    </button>
                                </div>
                            </div>

                            {/* 자산 요약 */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                <Card title="총 보유자산" value={summary.totalAssets} unit="원" />
                                <Card title="총 평가금액" value={summary.totalEvalAmount} unit="원" />
                                <Card title="총 평가손익" value={summary.totalProfit} unit="원" highlight />
                                <Card title="총 수익률" value={summary.totalProfitRate.toFixed(2)} unit="%" highlight />
                            </div>

                            {/* 코인 보유 목록 */}
                            <div>
                                <h3 className="text-lg font-semibold mb-3">보유 코인</h3>

                                {assets.length === 0 && (
                                    <div className="text-gray-400 text-sm">보유 코인이 없습니다.</div>
                                )}

                                {assets.length > 0 && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead>
                                            <tr className="border-b border-white/20 text-gray-400">
                                                <th className="px-3 py-2">코인</th>
                                                <th className="px-3 py-2 text-right">보유수량</th>
                                                <th className="px-3 py-2 text-right">매수금액</th>
                                                <th className="px-3 py-2 text-right">평균단가</th>
                                                <th className="px-3 py-2 text-right">평가금액</th>
                                                <th className="px-3 py-2 text-right">평가손익</th>
                                                <th className="px-3 py-2 text-right">수익률</th>
                                            </tr>
                                            </thead>

                                            <tbody>
                                            {assets.map(coin => {
                                                const isProfit = Number(coin.profit) >= 0;

                                                return (
                                                    <tr key={coin.id}
                                                        className="border-b border-white/10 hover:bg-white/5 transition">
                                                        <td className="px-3 py-2 font-semibold">
                                                            {coin.tradingPair}
                                                        </td>
                                                        <td className="px-3 py-2 text-right">
                                                            {coin.amount.toFixed(8)}
                                                        </td>
                                                        <td className="px-3 py-2 text-right">
                                                            {Number(coin.buyAmount).toLocaleString()} 원
                                                        </td>
                                                        <td className="px-3 py-2 text-right">
                                                            {Number(coin.avgPrice).toLocaleString()} 원
                                                        </td>
                                                        <td className="px-3 py-2 text-right">
                                                            {Number(coin.evalAmount).toLocaleString()} 원
                                                        </td>
                                                        <td className={`px-3 py-2 font-semibold text-right ${
                                                            isProfit ? "text-red-400" : "text-blue-400"
                                                        }`}>
                                                            {isProfit ? "▲" : "▼"}{" "}
                                                            {Math.abs(coin.profit).toLocaleString()} 원
                                                        </td>
                                                        <td className={`px-3 py-2 font-semibold text-right ${
                                                            isProfit ? "text-red-400" : "text-blue-400"
                                                        }`}>
                                                            {isProfit ? "+" : ""}
                                                            {coin.profitRate}%
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ========== 포트폴리오 탭 ========== */}
                    {activeTab === "portfolio" && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold mb-4">보유자산 포트폴리오</h3>

                            {portfolio.length === 0 && (
                                <div className="text-gray-400 text-sm">포트폴리오 데이터가 없습니다.</div>
                            )}

                            {portfolio.map(p => (
                                <div key={p.tradingPair} className="bg-white/5 p-4 rounded-lg">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="font-semibold">{p.tradingPair}</span>
                                        <div className="text-right">
                                            <div>{p.percent}%</div>
                                            <div className="text-gray-400 text-xs">
                                                {Number(p.valuation).toLocaleString()} 원
                                            </div>
                                        </div>
                                    </div>
                                    <div className="h-2 bg-gray-700 rounded overflow-hidden">
                                        <div
                                            className="h-2 bg-indigo-400 rounded transition-all duration-300"
                                            style={{ width: `${Math.min(p.percent, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ========== 보유코인 탭 ========== */}
                    {activeTab === "coins" && (
                        <div className="space-y-6">
                            {/* 코인 등록 */}
                            <div className="bg-white/5 p-4 rounded-xl">
                                <h3 className="text-lg font-semibold mb-3">코인 자산 등록</h3>
                                <div className="flex gap-2 flex-wrap">
                                    <select
                                        value={coinInput}
                                        onChange={e => setCoinInput(e.target.value)}
                                        className="px-3 py-2 rounded bg-white/10 text-white min-w-[200px]"
                                    >
                                        <option value="">코인 선택</option>
                                        {markets.map(m => (
                                            <option key={m.market} value={m.market}>
                                                {m.market} ({m.korean_name || m.koreanName})
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        value={coinAmount}
                                        onChange={e => setCoinAmount(e.target.value)}
                                        placeholder="매수 금액 (원)"
                                        className="px-3 py-2 rounded bg-white/10 text-white w-48"
                                        min="1"
                                    />
                                    <button
                                        onClick={handleAddCoin}
                                        className="px-4 py-2 bg-indigo-500 rounded hover:bg-indigo-600 transition"
                                    >
                                        등록
                                    </button>
                                </div>
                            </div>

                            {/* 코인 수정 */}
                            <div className="bg-white/5 p-4 rounded-xl">
                                <h3 className="text-lg font-semibold mb-3">코인 매수 금액 수정</h3>
                                <div className="flex gap-2 flex-wrap">
                                    <select
                                        value={selectedCoin}
                                        onChange={e => setSelectedCoin(e.target.value)}
                                        className="px-3 py-2 rounded bg-white/10 text-white min-w-[200px]"
                                    >
                                        <option value="">수정할 코인 선택</option>
                                        {assets.map(c => (
                                            <option key={c.id} value={c.tradingPair}>
                                                {c.tradingPair}
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        value={newCoinAmount}
                                        onChange={e => setNewCoinAmount(e.target.value)}
                                        placeholder="새 매수 금액 (원)"
                                        className="px-3 py-2 rounded bg-white/10 text-white w-48"
                                        min="1"
                                    />
                                    <button
                                        onClick={handleUpdateCoin}
                                        className="px-4 py-2 bg-green-500 rounded hover:bg-green-600 transition"
                                    >
                                        수정
                                    </button>
                                    {selectedCoin && (
                                        <button
                                            onClick={() => {
                                                const asset = assets.find(a => a.tradingPair === selectedCoin);
                                                if (asset) handleDeleteCoin(asset.id);
                                            }}
                                            className="px-4 py-2 bg-red-500 rounded hover:bg-red-600 transition"
                                        >
                                            삭제
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* 코인 목록 */}
                            <div>
                                <h3 className="text-lg font-semibold mb-3">보유 코인 목록</h3>

                                {assets.length === 0 && (
                                    <div className="text-gray-400 text-sm">보유 코인이 없습니다.</div>
                                )}

                                {assets.length > 0 && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead>
                                            <tr className="border-b border-white/20 text-gray-400">
                                                <th className="px-3 py-2">코인</th>
                                                <th className="px-3 py-2 text-right">보유수량</th>
                                                <th className="px-3 py-2 text-right">매수평균가</th>
                                                <th className="px-3 py-2 text-right">매수금액</th>
                                                <th className="px-3 py-2 text-right">평가금액</th>
                                                <th className="px-3 py-2 text-right">평가손익</th>
                                                <th className="px-3 py-2 text-right">수익률</th>
                                                <th className="px-3 py-2">작업</th>
                                            </tr>
                                            </thead>
                                            <tbody>
                                            {assets.map(coin => {
                                                const isProfit = Number(coin.profit) >= 0;
                                                return (
                                                    <tr key={coin.id} className="border-b border-white/10 hover:bg-white/5">
                                                        <td className="px-3 py-2 font-semibold">{coin.tradingPair}</td>
                                                        <td className="px-3 py-2 text-right">{coin.amount?.toFixed(8) || 0}</td>
                                                        <td className="px-3 py-2 text-right">{coin.avgPrice?.toLocaleString() || 0}원</td>
                                                        <td className="px-3 py-2 text-right">{coin.buyAmount?.toLocaleString() || 0}원</td>
                                                        <td className="px-3 py-2 text-right">{coin.evalAmount?.toLocaleString() || 0}원</td>
                                                        <td className={`px-3 py-2 text-right font-semibold ${isProfit ? "text-red-400" : "text-blue-400"}`}>
                                                            {isProfit ? "▲" : "▼"} {Math.abs(coin.profit).toLocaleString()}원
                                                        </td>
                                                        <td className={`px-3 py-2 text-right font-semibold ${isProfit ? "text-red-400" : "text-blue-400"}`}>
                                                            {coin.profitRate}%
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <button
                                                                onClick={() => handleDeleteCoin(coin.id)}
                                                                className="px-2 py-1 bg-red-500/80 rounded text-xs hover:bg-red-600 transition"
                                                            >
                                                                삭제
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ========== 관심코인 탭 ========== */}
                    {activeTab === "favorites" && (
                        <div className="space-y-4">
                            {/* 코인 검색 */}
                            <div className="bg-white/5 p-4 rounded-xl">
                                <h3 className="text-lg font-semibold mb-3">코인 검색</h3>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="코인명, 마켓, 한글명, 영문명 등"
                                        value={searchText}
                                        onChange={e => setSearchText(e.target.value)}
                                        onKeyPress={e => e.key === 'Enter' && handleSearchCoin(searchText)}
                                        className="px-3 py-2 rounded bg-white/10 flex-1 text-white"
                                    />
                                    <button
                                        onClick={() => handleSearchCoin(searchText)}
                                        className="px-4 py-2 bg-indigo-500 rounded hover:bg-indigo-600 transition"
                                    >
                                        검색
                                    </button>
                                </div>
                            </div>

                            {/* 검색 결과 */}
                            {coinSearchResult.length > 0 && (
                                <div className="bg-white/5 p-4 rounded-xl">
                                    <h4 className="font-semibold mb-2">검색 결과</h4>
                                    <ul className="space-y-2">
                                        {coinSearchResult.map(c => (
                                            <li
                                                key={c.market}
                                                className="bg-white/10 p-3 rounded flex justify-between items-center"
                                            >
                                                <div>
                                                    <div className="font-semibold">{c.market}</div>
                                                    <div className="text-xs text-gray-400">
                                                        {c.koreanName} / {c.englishName}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleAddFavorite(c.market)}
                                                    className="px-3 py-1 bg-green-500 rounded text-sm hover:bg-green-600 transition"
                                                >
                                                    ⭐ 추가
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* 관심 코인 목록 */}
                            <div className="bg-white/5 p-4 rounded-xl">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-lg font-semibold">관심 코인 목록</h3>
                                    {favorites.length > 0 && (
                                        <button
                                            onClick={handleDeleteAllFavorites}
                                            className="px-3 py-1 bg-red-700 rounded text-sm hover:bg-red-800 transition"
                                        >
                                            전체 삭제
                                        </button>
                                    )}
                                </div>

                                {favorites.length === 0 && (
                                    <div className="text-gray-400 text-sm">관심 코인이 없습니다.</div>
                                )}

                                {favorites.length > 0 && (
                                    <ul className="space-y-2">
                                        {favorites.map(f => (
                                            <li
                                                key={f.id || f.tradingPairId}
                                                className="flex justify-between items-center bg-white/10 p-3 rounded hover:bg-white/15 transition"
                                            >
                                                <div>
                                                    <div className="font-semibold">
                                                        {f.tradingPair?.market || f.market || "UNKNOWN"}
                                                    </div>
                                                    <div className="text-xs text-gray-400">
                                                        {f.tradingPair?.koreanName || f.koreanName || ""} /
                                                        {f.tradingPair?.englishName || f.englishName || ""}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteFavorite(f.tradingPairId || f.id)}
                                                    className="px-3 py-1 bg-red-500 rounded text-sm hover:bg-red-600 transition"
                                                >
                                                    삭제
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function Card({ title, value, unit = "", highlight = false }) {
    const num = Number(value);
    const isProfit = num >= 0;

    return (
        <div className="bg-white/5 p-5 rounded-2xl text-center backdrop-blur-sm hover:bg-white/10 transition">
            <div className="text-sm text-gray-400 mb-2">{title}</div>
            <div className={`text-2xl font-bold mt-3 ${
                highlight ? (isProfit ? "text-red-400" : "text-blue-400") : "text-white"
            }`}>
                {highlight && (isProfit ? "+" : "")}
                {num.toLocaleString()}
                {unit && <span className="text-lg ml-1">{unit}</span>}
            </div>
        </div>
    );
}

function TabButton({ active, children, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`px-5 py-2 rounded-lg font-semibold transition ${
                active
                    ? "bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.6)]"
                    : "bg-white/10 hover:bg-white/20"
            }`}
        >
            {children}
        </button>
    );
}