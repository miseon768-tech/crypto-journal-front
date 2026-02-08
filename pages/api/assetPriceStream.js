import axios from "axios";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:8080/api/KRWAssets/summary";

export const coinProfit = async (token, market) => {
  const res = await axios.get(`${API_BASE}/profit`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { market },
  });
  return res.data;
};

export const getTotalProfit = async (token) => {
  const res = await axios.get(`${API_BASE}/profit/total`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export const coinEvalAmount = async (token, market) => {
  const res = await axios.get(`${API_BASE}/eval-amount`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { market },
  });
  return res.data;
};

export const getTotalEvalAmount = async (token) => {
  const res = await axios.get(`${API_BASE}/total-eval-amount`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export const getTotalAssets = async (token) => {
  const res = await axios.get(`${API_BASE}/total`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export const getTotalProfitRate = async (token) => {
  const res = await axios.get(`${API_BASE}/profit-rate`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export const getPortfolioAsset = async (token) => {
  const res = await axios.get(`${API_BASE}/portfolio`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};
