import { useEffect, useState } from "react";
import {
  addFavoriteCoin,
  getFavoriteCoins,
  deleteFavoriteCoin,
  deleteAllFavoriteCoins,
} from "../api/favoriteCoin";

export default function FavoriteCoinPage() {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [coins, setCoins] = useState([]);
  const [newCoin, setNewCoin] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    if (!token) return;
    getFavoriteCoins(token).then((res) => setCoins(res.coins || []));
  }, [token]);

  const handleAdd = async () => {
    try {
      const res = await addFavoriteCoin(newCoin, token);
      setCoins(res.coins || []);
      setNewCoin("");
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteSelected = async () => {
    try {
      await deleteFavoriteCoin(selectedIds, token);
      setCoins((prev) =>
        prev.filter((c) => !selectedIds.includes(c.tradingPairId)),
      );
      setSelectedIds([]);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteAll = async () => {
    try {
      await deleteAllFavoriteCoins(token);
      setCoins([]);
      setSelectedIds([]);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">관심 코인</h1>

      <div className="flex gap-3 mb-6">
        <input
          className="flex-1 p-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 transition"
          placeholder="코인 입력"
          value={newCoin}
          onChange={(e) => setNewCoin(e.target.value)}
        />
        <button className="px-4 py-3 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-700 active:scale-95 transition-all">
          추가
        </button>
      </div>

      {coins.length === 0 ? (
        <p className="text-gray-500 mb-4">추가된 코인이 없습니다.</p>
      ) : (
        <ul className="space-y-2 mb-6">
          {coins.map((c) => (
            <li
              key={c.tradingPairId}
              className="flex items-center justify-between p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900"
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(c.tradingPairId)}
                  onChange={(e) => {
                    if (e.target.checked)
                      setSelectedIds((prev) => [...prev, c.tradingPairId]);
                    else
                      setSelectedIds((prev) =>
                        prev.filter((id) => id !== c.tradingPairId),
                      );
                  }}
                  className="w-4 h-4 accent-gray-800"
                />
                <span>
                  {c.market} - {c.koreanName} ({c.englishName})
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-3">
        <button className="flex-1 px-4 py-3 bg-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-200 active:scale-95 transition-all">
          선택 삭제
        </button>
        <button className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 active:scale-95 transition-all">
          전체 삭제
        </button>
      </div>
    </div>
  );
}
