
const API_BASE = "http://localhost:8080/api/coin/assets";

// 자산 검색
export const getAssetByTradingPair = async (tradingPairId, token) => {
  const headers = { ...authHeader(token) };
  const res = await fetch(`${API_BASE}/${tradingPairId}`, {
    headers,
  });
  if (!res.ok) throw new Error("자산 조회 실패");
  return res.json();
};

export const getAssetByMarket = async (market, token) => {
  const headers = { ...authHeader(token) };
  const res = await fetch(`${API_BASE}/market?market=${market}`, {
    headers,
  });
  if (!res.ok) throw new Error("자산 조회 실패");
  return res.json();
};

export const getAssetByKorean = async (name, token) => {
  const headers = { ...authHeader(token) };
  const res = await fetch(`${API_BASE}/korean?koreanName=${name}`, {
    headers,
  });
  if (!res.ok) throw new Error("자산 조회 실패");
  return res.json();
};

export const getAssetByEnglish = async (name, token) => {
  const headers = { ...authHeader(token) };
  const res = await fetch(`${API_BASE}/english?englishName=${name}`, {
    headers,
  });
  if (!res.ok) throw new Error("자산 조회 실패");
  return res.json();
};

export const getAssetByCategory = async (params, token) => {
  const query = new URLSearchParams(params).toString();
  const headers = { ...authHeader(token) };
  const res = await fetch(`${API_BASE}/category?${query}`, {
    headers,
  });
  if (!res.ok) throw new Error("자산 조회 실패");
  return res.json();
};

// 매수금액
export const upsertCoinBuyAmount = async (amount, token) => {
  const headers = {
    "Content-Type": "application/json",
    ...authHeader(token),
  };
  const res = await fetch(`${API_BASE}/purchase-by-coin`, {
    method: "POST",
    headers,
    body: JSON.stringify(amount),
  });
  if (!res.ok) throw new Error("매수금액 입력 실패");
  return res.json();
};

export const getCoinBuyAmount = async (token) => {
  const headers = { ...authHeader(token) };
  const res = await fetch(`${API_BASE}/purchase-by-coin`, {
    headers,
  });
  if (!res.ok) throw new Error("매수금액 조회 실패");
  return res.json();
};

export const getTotalCoinBuyAmount = async (token) => {
  const headers = { ...authHeader(token) };
  const res = await fetch(`${API_BASE}/total-purchase-amount`, {
    headers,
  });
  if (!res.ok) throw new Error("총 매수금액 조회 실패");
  return res.json();
};
