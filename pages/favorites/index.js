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
    <div style={{ maxWidth: 800, margin: "auto", padding: 20 }}>
      <h1>관심 코인</h1>

      <div>
        <input
          placeholder="코인 입력"
          value={newCoin}
          onChange={(e) => setNewCoin(e.target.value)}
        />
        <button onClick={handleAdd}>추가</button>
      </div>

      <ul>
        {coins.map((c) => (
          <li key={c.tradingPairId}>
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
            />
            {c.market} - {c.koreanName} ({c.englishName})
          </li>
        ))}
      </ul>

      <button onClick={handleDeleteSelected}>선택 삭제</button>
      <button onClick={handleDeleteAll}>전체 삭제</button>
    </div>
  );
}
