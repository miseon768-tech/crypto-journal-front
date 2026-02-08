import { useEffect, useState } from "react";
import {
  addAsset,
  updateAsset,
  deleteAsset,
  getAssets,
  upsertCashBalance,
  getCashBalance,
} from "../../lib/api/krwAsset";

export default function KrwAssetPage() {
  const [token, setToken] = useState("");
  const [assets, setAssets] = useState([]);
  const [cashBalance, setCashBalance] = useState(0);

  useEffect(() => {
    const savedToken = localStorage.getItem("accessToken");
    if (!savedToken) return;
    setToken(savedToken);

    const fetchData = async () => {
      const assetList = await getAssets(savedToken);
      const cash = await getCashBalance(savedToken);

      setAssets(assetList.krwAssetList || []);
      setCashBalance(cash.cashBalance || 0);
    };

    fetchData();
  }, []);

  return (
    <div>
      <h1>KRW 자산 관리</h1>
      <p>주문 가능 금액: {cashBalance}</p>
      <h2>보유 자산</h2>
      <ul>
        {assets.map((asset) => (
          <li key={asset.id}>
            {asset.name}: {asset.amount} {asset.currency}
          </li>
        ))}
      </ul>
    </div>
  );
}
