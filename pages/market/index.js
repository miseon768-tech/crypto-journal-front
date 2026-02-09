import { useEffect, useState } from "react";
import { getAllMarkets } from "../../pages/api/tradingPair";

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
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">마켓 목록</h1>

      {tradingPairs.length === 0 ? (
        <p className="text-gray-500">등록된 마켓이 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {tradingPairs.map((pair) => (
            <li
              key={pair.id}
              className="p-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-100 transition"
            >
              <span className="font-semibold">{pair.market}</span>
              <span className="text-gray-600"> {pair.koreanName}</span>
              <span className="text-gray-500"> ({pair.englishName})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
