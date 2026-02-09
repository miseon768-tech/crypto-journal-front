import { useEffect, useState } from "react";
import {
  coinProfit,
  getTotalProfit,
  coinEvalAmount,
  getTotalEvalAmount,
  getTotalAssets,
  getTotalProfitRate,
  getPortfolioAsset,
} from "../api/assetPriceStream";

export default function AssetPriceStreamPage() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    coinProfit: null,
    totalProfit: null,
    coinEval: null,
    totalEval: null,
    totalAssets: null,
    totalProfitRate: null,
    portfolio: [],
  });

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    if (!savedToken) {
      setLoading(false);
      return;
    }
    setToken(savedToken);

    const fetchData = async () => {
      try {
        const coin = await coinProfit(savedToken, "BTC");
        const totalProfit = await getTotalProfit(savedToken);
        const coinEval = await coinEvalAmount(savedToken, "BTC");
        const totalEval = await getTotalEvalAmount(savedToken);
        const totalAssets = await getTotalAssets(savedToken);
        const profitRate = await getTotalProfitRate(savedToken);
        const portfolio = await getPortfolioAsset(savedToken);

        setData({
          coinProfit: coin?.profit ?? null,
          totalProfit: totalProfit?.totalProfit ?? null,
          coinEval: coinEval?.evalAmount ?? null,
          totalEval: totalEval?.totalEvalAmount ?? null,
          totalAssets: totalAssets?.totalAssets ?? null,
          totalProfitRate: profitRate?.totalProfitRate ?? null,
          portfolio: portfolio?.portfolioItemList || [],
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        로그인 후 이용해주세요.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">자산 평가 요약</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-white rounded-lg shadow">
            <p className="text-gray-500">총 평가 손익</p>
            <p className="text-xl font-semibold">{data.totalProfit ?? "-"}</p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow">
            <p className="text-gray-500">총 평가 금액</p>
            <p className="text-xl font-semibold">{data.totalEval ?? "-"}</p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow">
            <p className="text-gray-500">총 자산</p>
            <p className="text-xl font-semibold">{data.totalAssets ?? "-"}</p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow">
            <p className="text-gray-500">총 수익률</p>
            <p className="text-xl font-semibold">
              {data.totalProfitRate ?? "-"}%
            </p>
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            BTC 평가 요약
          </h2>
          <p className="text-gray-600">평가 손익: {data.coinProfit ?? "-"}</p>
          <p className="text-gray-600">평가 금액: {data.coinEval ?? "-"}</p>
        </div>

        <div className="p-4 bg-white rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            포트폴리오
          </h2>
          {data.portfolio.length === 0 ? (
            <p className="text-gray-500">보유 자산이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {data.portfolio.map((item) => (
                <li key={item.market} className="flex justify-between">
                  <span>{item.market}</span>
                  <span>{item.percentage}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
