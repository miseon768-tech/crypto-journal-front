import { useEffect, useState } from "react";
import {
  addAsset,
  updateAsset,
  deleteAsset,
  getAssets,
  upsertCashBalance,
  getCashBalance,
} from "../api/krwAsset";

export default function KrwAssetPage() {
  const [token, setToken] = useState("");
  const [assets, setAssets] = useState([]);
  const [cashBalance, setCashBalance] = useState(0);
  const [newCashBalance, setNewCashBalance] = useState(0);
  const [form, setForm] = useState({ cashBalance: 0, totalByAmount: 0 });
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    if (!savedToken) return;
    setToken(savedToken);

    const fetchData = async () => {
      const assetList = await getAssets(savedToken);
      const cash = await getCashBalance(savedToken);

      setAssets(assetList.KrwAssetList || []);
      setCashBalance(cash.cashBalance || 0);
      setNewCashBalance(cash.cashBalance || 0);
    };

    fetchData();
  }, []);

  const refreshAssets = async () => {
    if (!token) return;
    const assetList = await getAssets(token);
    setAssets(assetList.KrwAssetList || []);
  };

  const handleAdd = async () => {
    if (!token) return;
    await addAsset(token, form);
    setForm({ cashBalance: 0, totalByAmount: 0 });
    refreshAssets();
  };

  const handleUpdate = async () => {
    if (!token || !selectedId) return;
    await updateAsset(token, selectedId, form);
    refreshAssets();
  };

  const handleDelete = async (assetId) => {
    if (!token) return;
    await deleteAsset(token, assetId);
    if (selectedId === assetId) setSelectedId("");
    refreshAssets();
  };

  const handleCashBalanceSave = async () => {
    if (!token) return;
    await upsertCashBalance(token, newCashBalance);
    const cash = await getCashBalance(token);
    setCashBalance(cash.cashBalance || 0);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        로그인 후 이용해주세요.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-gray-900 text-center">
          KRW 자산 관리
        </h1>

        <div className="bg-white p-6 rounded-lg shadow space-y-3">
          <p className="text-gray-800 font-medium">
            주문 가능 금액: <span className="font-bold">{cashBalance} KRW</span>
          </p>
          <div className="flex gap-3">
            <input
              type="number"
              className="flex-1 p-2 border border-gray-300 rounded"
              value={newCashBalance}
              onChange={(e) => setNewCashBalance(Number(e.target.value))}
              placeholder="주문 가능 금액"
            />
            <button
              onClick={handleCashBalanceSave}
              className="px-4 py-2 bg-gray-800 text-white rounded"
            >
              저장
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">자산 입력</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="number"
              className="p-2 border border-gray-300 rounded"
              value={form.cashBalance}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  cashBalance: Number(e.target.value),
                }))
              }
              placeholder="현금 보유"
            />
            <input
              type="number"
              className="p-2 border border-gray-300 rounded"
              value={form.totalByAmount}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  totalByAmount: Number(e.target.value),
                }))
              }
              placeholder="총 매수 금액"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-gray-800 text-white rounded"
            >
              추가
            </button>
            <button
              onClick={handleUpdate}
              disabled={!selectedId}
              className="px-4 py-2 bg-gray-600 text-white rounded disabled:opacity-40"
            >
              선택 수정
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            보유 자산
          </h2>
          {assets.length === 0 ? (
            <p className="text-gray-700">보유 자산이 없습니다.</p>
          ) : (
            <ul className="space-y-3">
              {assets.map((asset) => (
                <li
                  key={asset.id}
                  className={`flex items-center justify-between p-4 border rounded-lg transition ${
                    selectedId === asset.id
                      ? "border-gray-900 bg-gray-100"
                      : "border-gray-200"
                  }`}
                >
                  <div>
                    <p className="text-gray-900 font-medium">
                      현금 보유: {asset.cashBalance}
                    </p>
                    <p className="text-gray-700">
                      총 매수 금액: {asset.totalByAmount}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedId(asset.id);
                        setForm({
                          cashBalance: asset.cashBalance,
                          totalByAmount: asset.totalByAmount,
                        });
                      }}
                      className="px-3 py-1 border border-gray-300 rounded"
                    >
                      선택
                    </button>
                    <button
                      onClick={() => handleDelete(asset.id)}
                      className="px-3 py-1 bg-red-500 text-white rounded"
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
