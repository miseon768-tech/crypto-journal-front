
const API_BASE = "http://localhost:8080/api/assets/favorites";

// 관심 코인 추가
export const addFavoriteCoin = async (coinInput, token) => {
  const headers = {
    "Content-Type": "application/json",
    ...authHeader(token),
  };
  const res = await fetch(`${API_BASE}`, {
    method: "POST",
    headers,
    body: JSON.stringify(coinInput),
  });
  if (!res.ok) throw new Error("관심 코인 추가 실패");
  return res.json();
};

// 관심 코인 조회
export const getFavoriteCoins = async (token) => {
  const headers = {
    ...authHeader(token),
  };
  const res = await fetch(`${API_BASE}`, {
    headers,
  });
  if (!res.ok) throw new Error("관심 코인 조회 실패");
  return res.json();
};

// 선택 삭제
export const deleteFavoriteCoin = async (ids, token) => {
  const headers = {
    "Content-Type": "application/json",
    ...authHeader(token),
  };
  const res = await fetch(`${API_BASE}/select`, {
    method: "DELETE",
    headers,
    body: JSON.stringify(ids),
  });
  if (!res.ok) throw new Error("선택 삭제 실패");
  return res.json();
};

// 전체 삭제
export const deleteAllFavoriteCoins = async (token) => {
  const headers = {
    ...authHeader(token),
  };
  const res = await fetch(`${API_BASE}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error("전체 삭제 실패");
  return res.json();
};
