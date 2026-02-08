const API_BASE = "http://localhost:8080/api/coin/assets";

// 자산 검색
export const getAssetByTradingPair = async (tradingPairId, token) => {
  const res = await fetch(`${API_BASE}/${tradingPairId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("자산 조회 실패");
  return res.json();
};

export const getAssetByMarket = async (market, token) => {
  const res = await fetch(`${API_BASE}/market?market=${market}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("자산 조회 실패");
  return res.json();
};

export const getAssetByKorean = async (name, token) => {
  const res = await fetch(`${API_BASE}/korean?koreanName=${name}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("자산 조회 실패");
  return res.json();
};

export const getAssetByEnglish = async (name, token) => {
  const res = await fetch(`${API_BASE}/english?englishName=${name}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("자산 조회 실패");
  return res.json();
};

export const getAssetByCategory = async (params, token) => {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/category?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("자산 조회 실패");
  return res.json();
};

// 매수금액
export const upsertCoinBuyAmount = async (amount, token) => {
  const res = await fetch(`${API_BASE}/purchase-by-coin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(amount),
  });
  if (!res.ok) throw new Error("매수금액 입력 실패");
  return res.json();
};

export const getCoinBuyAmount = async (token) => {
  const res = await fetch(`${API_BASE}/purchase-by-coin`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("매수금액 조회 실패");
  return res.json();
};

export const getTotalCoinBuyAmount = async (token) => {
  const res = await fetch(`${API_BASE}/total-purchase-amount`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("총 매수금액 조회 실패");
  return res.json();
};
