import { useEffect, useState } from "react";
import {
  addAsset,
  updateAsset,
  deleteAsset,
  getAssets,
  upsertCashBalance,
  getCashBalance,
} from "../../pages/api/krwAsset";

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
    <div className="min-h-screen bg-gray-50 font-sans p-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-4 text-center">
          KRW 자산 관리
        </h1>

        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <p className="text-gray-800 font-medium">
            주문 가능 금액: <span className="font-bold">{cashBalance} KRW</span>
          </p>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">보유 자산</h2>
        {assets.length === 0 ? (
          <p className="text-gray-700">보유 자산이 없습니다.</p>
        ) : (
          <ul className="space-y-3">
            {assets.map((asset) => (
              <li
                key={asset.id}
                className="flex justify-between items-center p-4 bg-white rounded-lg shadow hover:bg-gray-100 transition"
              >
                <span className="text-gray-900 font-medium">{asset.name}</span>
                <span className="text-gray-700">
                  {asset.amount} {asset.currency}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
