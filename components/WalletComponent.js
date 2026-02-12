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
    const [summary, setSummary] = useState({ totalAsset: 0, totalEval: 0, totalProfit: 0, profitRate: 0 });
    const [assets, setAssets] = useState([]);
    const [portfolio, setPortfolio] = useState([]);
    const [loading, setLoading] = useState(true);
    const [markets, setMarkets] = useState([]);
    const [favorites, setFavorites] = useState([]);
    const [krwInput, setKrwInput] = useState("");
    const [coinInput, setCoinInput] = useState("");
    const [coinAmount, setCoinAmount] = useState("");
    const [selectedCoin, setSelectedCoin] = useState(""); // 수정할 코인 선택
    const [newCoinAmount, setNewCoinAmount] = useState(""); // 수정할 금액
    const [searchText, setSearchText] = useState(""); // 통합 검색창
    const [coinSearchResult, setCoinSearchResult] = useState([]); // 검색 결과
    const [searchParams, setSearchParams] = useState({
        tradingPairId: "",
        market: "",
        koreanName: "",
        englishName: "",
    });
    const [totalBuyAmount, setTotalBuyAmount] = useState(0); // 총 매수금액

    const token = typeof window !== "undefined" ? getStoredToken(localStorage.getItem("token")) : null;

    useEffect(() => {
        if (!token) return;
        fetchWalletData();
        fetchCoins();
        fetchMarkets();
        fetchFavorites();
        fetchTotalBuyAmount();
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

            setSummary({ totalAsset, totalEval, totalProfit, profitRate: (Number(profitRate) || 0).toFixed(2) });

            const formattedPortfolio = (portfolioData || []).map(p => ({
                tradingPair: p.tradingPair || p.name || "UNKNOWN",
                percent: Number(p.percent?.toFixed(2)) || 0,
            }));
            setPortfolio(formattedPortfolio);
        } catch (e) {
            console.error("Wallet fetch error:", e);
        } finally {
            setLoading(false);
        }
    };

    // ===== 보유코인 fetch =====
    const fetchCoins = async () => {
        if (!token) return;
        try {
            const coinAssetsRes = await getAssets(token);
            const coinAssets = Array.isArray(coinAssetsRes) ? coinAssetsRes : [];

            const assetPromises = coinAssets.map(async c => {
                const [evalRes, profitRes, buyAmountRes] = await Promise.allSettled([
                    getCoinEvalAmount(token, c.market),
                    getCoinProfit(token, c.market),
                    getCoinBuyAmount(token, c.market),
                ]);

                const evalAmount = evalRes.status === "fulfilled" ? evalRes.value : 0;
                const profit = profitRes.status === "fulfilled" ? profitRes.value : 0;
                const buyAmount = buyAmountRes.status === "fulfilled" ? buyAmountRes.value : 0;
                const profitRate = evalAmount ? ((profit / (evalAmount - profit)) * 100).toFixed(2) : '0.00';

                return {
                    tradingPair: c.market,
                    amount: c.amount || 0,
                    buyAmount,
                    avgPrice: c.avgPrice || 0,
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

    // ===== 총 매수금액 fetch =====
    const fetchTotalBuyAmount = async () => {
        if (!token) return;
        try {
            const data = await getTotalCoinBuyAmount(token);
            setTotalBuyAmount(data.totalBuyAmount || 0);
        } catch (e) {
            console.error("총 매수금액 조회 실패:", e);
        }
    };

    // ===== KRW 등록 =====
    const handleAddKrw = async () => {
        if (!krwInput || isNaN(krwInput)) return alert("금액을 숫자로 입력하세요");
        try {
            await upsertCashBalance(token, Number(krwInput));
            setKrwInput("");
            fetchWalletData();
        } catch (e) {
            console.error(e);
            alert("KRW 등록 실패");
        }
    };

    // ===== 코인 등록 =====
    const handleAddCoin = async () => {
        if (!coinInput || !coinAmount || isNaN(coinAmount)) return alert("코인과 금액을 정확히 입력하세요");
        try {
            await addAsset(token, { market: coinInput.toUpperCase(), amount: Number(coinAmount) });
            setCoinInput("");
            setCoinAmount("");
            fetchCoins();
            fetchTotalBuyAmount();
        } catch (e) {
            console.error(e);
            alert("코인 등록 실패");
        }
    };

    // ===== 코인 수정 =====
    const handleUpdateCoin = async () => {
        if (!selectedCoin || !newCoinAmount || isNaN(newCoinAmount)) return alert("코인과 금액을 정확히 입력하세요");
        try {
            await updateAsset(token, { market: selectedCoin, amount: Number(newCoinAmount) });
            setSelectedCoin("");
            setNewCoinAmount("");
            fetchCoins();
            fetchTotalBuyAmount();
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
            fetchCoins();
            fetchTotalBuyAmount();
        } catch (e) {
            console.error(e);
            alert("코인 삭제 실패");
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
    // 검색 함수
    const handleSearchCoin = async (text) => {
        if (!token || !text) return;

        try {
            const results = [];

            // 순차적으로 검색
            try {
                const r1 = await getAssetByTradingPair(text, token);
                if (r1) results.push(r1);
            } catch {}
            try {
                const r2 = await getAssetByMarket(text, token);
                if (r2) results.push(r2);
            } catch {}
            try {
                const r3 = await getAssetByKorean(text, token);
                if (r3) results.push(r3);
            } catch {}
            try {
                const r4 = await getAssetByEnglish(text, token);
                if (r4) results.push(r4);
            } catch {}

            // 중복 제거 (tradingPair 기준)
            const unique = results.reduce((acc, cur) => {
                if (!acc.find(item => item.tradingPair === cur.tradingPair)) acc.push(cur);
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

            {loading && <div>데이터를 불러오는 중...</div>}

            {!loading && portfolio.length === 0 && assets.length === 0 && favorites.length === 0 && (
                <div className="text-center text-gray-400 mt-10">현재 등록된 자산이 없습니다.</div>
            )}

            {!loading && (
                <>
                    {/* 보유자산 탭 */}
                    {activeTab === "myAssets" && (
                        <div className="space-y-4">
                            <div className="flex gap-2 mb-4">
                                <input type="number" value={krwInput} onChange={e => setKrwInput(e.target.value)}
                                       placeholder="KRW 금액" className="px-2 py-1 rounded bg-white/10" />
                                <button onClick={handleAddKrw} className="px-3 py-1 bg-indigo-500 rounded">KRW 등록</button>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Card title="총 보유자산" value={summary.totalAsset} />
                                <Card title="총 평가금액" value={summary.totalEval} />
                                <Card title="평가손익" value={summary.totalProfit} />
                                <Card title="수익률 (%)" value={summary.profitRate} />
                            </div>
                        </div>
                    )}

                    {/* 포트폴리오 탭 */}
                    {activeTab === "portfolio" && (
                        <div className="space-y-2 border-t border-white/10 pt-2">
                            {portfolio.map(p => (
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
                            <div className="flex gap-2 mb-4">
                                <select value={coinInput} onChange={e => setCoinInput(e.target.value)}
                                        className="px-2 py-1 rounded bg-white/10">
                                    <option value="">코인 선택</option>
                                    {markets.map(m => (
                                        <option key={m.market} value={m.market}>{m.market}({m.korean_name})</option>
                                    ))}
                                </select>
                                <input type="number" value={coinAmount} onChange={e => setCoinAmount(e.target.value)}
                                       placeholder="매수 금액" className="px-2 py-1 rounded bg-white/10" />
                                <button onClick={handleAddCoin} className="px-3 py-1 bg-indigo-500 rounded">코인 등록</button>
                            </div>

                            {/* 코인 수정/삭제 */}
                            <div className="flex gap-2 mb-4">
                                <select value={selectedCoin} onChange={e => setSelectedCoin(e.target.value)}
                                        className="px-2 py-1 rounded bg-white/20">
                                    <option value="">수정할 코인 선택</option>
                                    {assets.map(c => (
                                        <option key={c.tradingPair} value={c.tradingPair}>{c.tradingPair}</option>
                                    ))}
                                </select>
                                <input type="number" value={newCoinAmount} onChange={e => setNewCoinAmount(e.target.value)}
                                       placeholder="새 매수 금액" className="px-2 py-1 rounded bg-white/20" />
                                <button onClick={handleUpdateCoin} className="px-3 py-1 bg-green-500 rounded">수정</button>
                                {selectedCoin && <button onClick={() => handleDeleteCoin(selectedCoin)}
                                                         className="px-3 py-1 bg-red-500 rounded">삭제</button>}
                            </div>

                            {assets.length === 0 && <div className="text-gray-400 text-sm">보유 코인이 없습니다.</div>}
                            {assets.length > 0 && (
                                <table className="w-full text-sm text-left">
                                    <thead>
                                    <tr className="border-b border-white/20">
                                        <th className="px-2 py-1">코인</th>
                                        <th className="px-2 py-1">평가손익</th>
                                        <th className="px-2 py-1">수익률 (%)</th>
                                        <th className="px-2 py-1">보유수량</th>
                                        <th className="px-2 py-1">매수평균가</th>
                                        <th className="px-2 py-1">평가금액</th>
                                        <th className="px-2 py-1">매수금액</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {assets.map(coin => (
                                        <tr key={coin.tradingPair} className="border-b border-white/10">
                                            <td className="px-2 py-1">{coin.tradingPair}</td>
                                            <td className="px-2 py-1">{coin.profit?.toLocaleString() || 0}원</td>
                                            <td className="px-2 py-1">{coin.profitRate}%</td>
                                            <td className="px-2 py-1">{coin.amount || 0}</td>
                                            <td className="px-2 py-1">{coin.avgPrice?.toLocaleString() || 0}원</td>
                                            <td className="px-2 py-1">{coin.evalAmount?.toLocaleString() || 0}원</td>
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
                            {/* 통합 검색창 */}
                            <div className="flex gap-2 mb-4">
                                <input
                                    type="text"
                                    placeholder="코인명, 트레이딩페어, 마켓 등"
                                    value={searchText}
                                    onChange={e => setSearchText(e.target.value)}
                                    className="px-2 py-1 rounded bg-white/10 flex-1"
                                />
                                <button
                                    onClick={() => handleSearchCoin(searchText)}
                                    className="px-3 py-1 bg-indigo-500 rounded"
                                >
                                    검색
                                </button>
                            </div>

                            {/* 검색 결과 */}
                            {coinSearchResult.length > 0 && (
                                <div className="mb-2">
                                    <h4>검색 결과</h4>
                                    <ul className="space-y-1">
                                        {coinSearchResult.map(c => (
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

                            {/* 기존 관심 코인 리스트 */}
                            {favorites.length === 0 && <div className="text-gray-400 text-sm">관심 코인이 없습니다.</div>}
                            {favorites.length > 0 && (
                                <>
                                    <ul className="space-y-2">
                                        {favorites.map(f => (
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

function Card({ title, value }) {
    return (
        <div className="bg-white/10 p-4 rounded-xl text-center">
            <div className="text-sm text-gray-400">{title}</div>
            <div className="text-lg font-bold mt-2">{value ? Number(value).toLocaleString() : 0}</div>
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