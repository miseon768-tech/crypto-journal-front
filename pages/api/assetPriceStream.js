import axios from "axios";
import { getStoredToken } from "./_client";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:8080/api/KRWAssets/summary";

export const coinProfit = async (token, market) => {
  const t = getStoredToken(token);
  const res = await axios.get(`${API_BASE}/profit`, {
    headers: { Authorization: `Bearer ${t}` },
    params: { market },
  });
  return res.data;
};

export const getTotalProfit = async (token) => {
  const t = getStoredToken(token);
  const res = await axios.get(`${API_BASE}/profit/total`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  return res.data;
};

export const coinEvalAmount = async (token, market) => {
  const t = getStoredToken(token);
  const res = await axios.get(`${API_BASE}/eval-amount`, {
    headers: { Authorization: `Bearer ${t}` },
    params: { market },
  });
  return res.data;
};

export const getTotalEvalAmount = async (token) => {
  const t = getStoredToken(token);
  const res = await axios.get(`${API_BASE}/total-eval-amount`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  return res.data;
};

export const getTotalAssets = async (token) => {
  const t = getStoredToken(token);
  const res = await axios.get(`${API_BASE}/total`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  return res.data;
};

export const getTotalProfitRate = async (token) => {
  const t = getStoredToken(token);
  const res = await axios.get(`${API_BASE}/profit-rate`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  return res.data;
};

export const getPortfolioAsset = async (token) => {
  const t = getStoredToken(token);
  const res = await axios.get(`${API_BASE}/portfolio`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  return res.data;
};
