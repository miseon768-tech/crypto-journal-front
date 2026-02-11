import { useEffect, useState } from "react";
import {
    getTotalAssets,
    getTotalEvalAmount,
    getTotalProfit,
    getTotalProfitRate,
    getPortfolioAsset
} from "../api/assetPriceStream";
import { getStoredToken } from "../api/member";

export default function WalletComponent() {
    const [activeTab, setActiveTab] = useState("summary");
    const [summary, setSummary] = useState({});
    const [assets, setAssets] = useState([]);
    const [portfolio, setPortfolio] = useState([]);

    const getToken = () => {
        const raw = localStorage.getItem("token");
        return getStoredToken(raw);
    };

    useEffect(() => {
        const fetchData = async () => {
            const token = getToken();
            if (!token) return;

            try {
                const [
                    totalAsset,
                    totalEval,
                    totalProfit,
                    profitRate,
                    assetList,
                    portfolioData
                ] = await Promise.all([
                    getTotalAssets(token),
                    getTotalEvalAmount(token),
                    getTotalProfit(token),
                    getTotalProfitRate(token),
                    getPortfolioAsset(token),
                    getPortfolioAsset(token)
                ]);

                setSummary({ totalAsset, totalEval, totalProfit, profitRate });
                setAssets(assetList || []);
                setPortfolio(portfolioData || []);
            } catch (error) {
                console.error("Wallet data fetch error:", error);
            }
        };

        fetchData();
    }, []);

    return (
        <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-md min-h-[250px] space-y-6 text-white">
            <h2 className="text-xl font-bold">Wallet</h2>

            {/* ===== 탭 버튼 ===== */}
            <div className="flex gap-4">
                <TabButton active={activeTab === "summary"} onClick={() => setActiveTab("summary")}>Summary</TabButton>
                <TabButton active={activeTab === "assets"} onClick={() => setActiveTab("assets")}>Assets</TabButton>
                <TabButton active={activeTab === "portfolio"} onClick={() => setActiveTab("portfolio")}>Portfolio</TabButton>
            </div>

            {/* ===== 내용 영역 ===== */}
            {activeTab === "summary" && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card title="총 보유자산" value={summary.totalAsset} />
                    <Card title="총 평가금액" value={summary.totalEval} />
                    <Card title="총 평가손익" value={summary.totalProfit} />
                    <Card title="수익률 (%)" value={summary.profitRate} />
                </div>
            )}

            {activeTab === "assets" && (
                <div>
                    {assets?.map(coin => (
                        <div key={coin.id} className="flex justify-between border-b border-white/10 py-2">
                            <div>{coin.tradingPair}</div>
                            <div>{coin.quantity}</div>
                            <div>{coin.evalAmount?.toLocaleString()}원</div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === "portfolio" && (
                <div>
                    {portfolio?.map(p => (
                        <div key={p.tradingPair} className="mb-4">
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
        </div>
    );
}

/* ===== 버튼 ===== */
function TabButton({ children, active, onClick }) {
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

/* ===== 카드 ===== */
function Card({ title, value }) {
    return (
        <div className="bg-white/10 p-4 rounded-xl text-center">
            <div className="text-sm text-gray-400">{title}</div>
            <div className="text-lg font-bold mt-2">{value ? Number(value).toLocaleString() : 0}</div>
        </div>
    );
}