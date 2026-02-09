import { useEffect, useState } from "react";
import {
  getAssetByMarket,
  getAssetByKorean,
  getAssetByEnglish,
  getAssetByCategory,
  getCoinBuyAmount,
  upsertCoinBuyAmount,
  getTotalCoinBuyAmount,
} from "../api/coinAsset";

export default function CoinAssetPage() {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [searchType, setSearchType] = useState("market");
  const [market, setMarket] = useState("");
  const [koreanName, setKoreanName] = useState("");
  const [englishName, setEnglishName] = useState("");
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
      let res;
      if (searchType === "market") {
        res = await getAssetByMarket(market, token);
      } else if (searchType === "korean") {
        res = await getAssetByKorean(koreanName, token);
      } else if (searchType === "english") {
        res = await getAssetByEnglish(englishName, token);
      } else {
        res = await getAssetByCategory(
          { market, koreanName, englishName },
          token,
        );
      }
      setAssets(res.coinAssetList || []);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleBuyAmountSave = async () => {
    try {
      await upsertCoinBuyAmount(buyAmount, token);
      const total = await getTotalCoinBuyAmount(token);
      setTotalAmount(total.totalBuyAmount);
      alert("매수금액 저장 완료");
    } catch (err) {
      alert(err.message);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        로그인 후 이용해주세요.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "auto", padding: 20 }}>
      <h1>코인 자산</h1>

      <div>
        <h2>자산 조회</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value)}
          >
            <option value="market">마켓 코드</option>
            <option value="korean">한글명</option>
            <option value="english">영문명</option>
            <option value="category">카테고리(복합)</option>
          </select>
          <button onClick={handleSearch}>검색</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            placeholder="마켓 코드"
            value={market}
            onChange={(e) => setMarket(e.target.value)}
          />
          <input
            placeholder="한글명"
            value={koreanName}
            onChange={(e) => setKoreanName(e.target.value)}
          />
          <input
            placeholder="영문명"
            value={englishName}
            onChange={(e) => setEnglishName(e.target.value)}
          />
        </div>
        <ul>
          {assets.map((a) => (
            <li key={a.id}>
              {a.tradingPair?.market || "-"} - {a.tradingPair?.koreanName || "-"} (
              {a.tradingPair?.englishName || "-"})
            </li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: 20 }}>
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
