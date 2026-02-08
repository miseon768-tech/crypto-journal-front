import { useEffect, useState } from "react";
import {
  getAssetByMarket,
  getCoinBuyAmount,
  upsertCoinBuyAmount,
  getTotalCoinBuyAmount,
} from "../api/coinAsset";

export default function CoinAssetPage() {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [market, setMarket] = useState("");
  const [assets, setAssets] = useState([]);
  const [buyAmount, setBuyAmount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    if (!token) return;
    getCoinBuyAmount(token).then((res) => setBuyAmount(res.coinBuyAmountGet));
    getTotalCoinBuyAmount(token).then((res) =>
      setTotalAmount(res.totalBuyAmount),
    );
  }, [token]);

  const handleSearch = async () => {
    try {
      const res = await getAssetByMarket(market, token);
      setAssets(res.assets || []);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleBuyAmountSave = async () => {
    try {
      await upsertCoinBuyAmount(buyAmount, token);
      alert("매수금액 저장 완료");
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: "auto", padding: 20 }}>
      <h1>코인 자산</h1>

      <div>
        <h2>자산 조회</h2>
        <input
          placeholder="마켓 코드"
          value={market}
          onChange={(e) => setMarket(e.target.value)}
        />
        <button onClick={handleSearch}>검색</button>
        <ul>
          {assets.map((a) => (
            <li key={a.tradingPairId}>
              {a.market} - {a.koreanName} ({a.englishName})
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2>코인 매수금액</h2>
        <input
          type="number"
          value={buyAmount}
          onChange={(e) => setBuyAmount(Number(e.target.value))}
        />
        <button onClick={handleBuyAmountSave}>저장</button>
        <p>총 매수금액: {totalAmount}</p>
      </div>
    </div>
  );
}
