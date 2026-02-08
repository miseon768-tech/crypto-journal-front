import { useEffect, useState } from "react";
import {
  coinProfit,
  getTotalProfit,
  coinEvalAmount,
  getTotalEvalAmount,
  getTotalAssets,
  getTotalProfitRate,
  getPortfolioAsset,
} from "../../lib/api/assetPriceStream";

export default function AssetPriceStreamPage() {
  const [token, setToken] = useState("");
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
    // 로컬 스토리지에서 토큰 가져오기
    const savedToken = localStorage.getItem("accessToken");
    if (!savedToken) return;
    setToken(savedToken);

    const fetchData = async () => {
      const coin = await coinProfit(savedToken, "BTC"); // 예시: BTC
      const totalProfit = await getTotalProfit(savedToken);
      const coinEval = await coinEvalAmount(savedToken, "BTC");
      const totalEval = await getTotalEvalAmount(savedToken);
      const totalAssets = await getTotalAssets(savedToken);
      const profitRate = await getTotalProfitRate(savedToken);
      const portfolio = await getPortfolioAsset(savedToken);

      setData({
        coinProfit: coin,
        totalProfit,
        coinEval,
        totalEval,
        totalAssets,
        totalProfitRate: profitRate,
        portfolio: portfolio.portfolioItemList || [],
      });
    };

    fetchData();
  }, []);

  return (
    <div>
      <h1>자산 평가금액 스트림</h1>
      <p>총 평가 손익: {data.totalProfit?.totalProfit}</p>
      <p>총 평가 금액: {data.totalEval?.totalEvalAmount}</p>
      <p>총 자산: {data.totalAssets?.totalAssets}</p>
      <p>총 수익률: {data.totalProfitRate?.totalProfitRate}%</p>
      <h2>포트폴리오</h2>
      <ul>
        {data.portfolio.map((item) => (
          <li key={item.market}>
            {item.market}: {item.percentage}%
          </li>
        ))}
      </ul>
    </div>
  );
}
