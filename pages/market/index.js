import { useEffect, useState } from "react";
import { getAllMarkets } from "../../lib/api/tradingPair";

export default function MarketPage() {
  const [tradingPairs, setTradingPairs] = useState([]);

  useEffect(() => {
    const fetchMarkets = async () => {
      const data = await getAllMarkets();
      setTradingPairs(data.tradingPairs || []);
    };

    fetchMarkets();
  }, []);

  return (
    <div>
      <h1>마켓 목록</h1>
      <ul>
        {tradingPairs.map((pair) => (
          <li key={pair.id}>
            {pair.marketCode} / {pair.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
