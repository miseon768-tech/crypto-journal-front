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

    // 등록용 상태
    const [krwInput, setKrwInput] = useState("");
    const [coinInput, setCoinInput] = useState("");
    const [coinAmount, setCoinAmount] = useState("");

    const token = typeof window !== "undefined" ? getStoredToken(localStorage.getItem("token")) : null;

    useEffect(() => {
        if (!token) return;
        fetchWalletData();
        fetchCoins();
        fetchMarkets();
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
            const coinAssets = Array.isArray(coinAssetsRes) ? coinAssetsRes : []; // 배열인지 확인

            const assetPromises = coinAssets.map(async c => {
                const [evalRes, profitRes] = await Promise.allSettled([
                    getCoinEvalAmount(token, c.market),
                    getCoinProfit(token, c.market),
                ]);

                const evalAmount = evalRes.status === "fulfilled" ? evalRes.value : 0;
                const profit = profitRes.status === "fulfilled" ? profitRes.value : 0;
                const profitRate = evalAmount ? ((profit / (evalAmount - profit)) * 100).toFixed(2) : '0.00';

                return {
                    tradingPair: c.market,
                    amount: c.amount || 0,
                    buyAmount: c.buyAmount || 0,
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
        } catch (e) {
            console.error(e);
            alert("코인 등록 실패");
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
            </div>

            {loading && <div>데이터를 불러오는 중...</div>}

            {!loading && portfolio.length === 0 && assets.length === 0 && (
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