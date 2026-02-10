import axios from "axios";
import { authHeader } from "./_client";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:8080/api/KRWAssets/summary";

export const coinProfit = async (token, market) => {
  const headers = authHeader(token);
  const res = await axios.get(`${API_BASE}/profit`, { headers, params: { market } });
  return res.data;
};

export const getTotalProfit = async (token) => {
  const headers = authHeader(token);
  const res = await axios.get(`${API_BASE}/profit/total`, { headers });
  return res.data;
};

export const coinEvalAmount = async (token, market) => {
  const headers = authHeader(token);
  const res = await axios.get(`${API_BASE}/eval-amount`, { headers, params: { market } });
  return res.data;
};

export const getTotalEvalAmount = async (token) => {
  const headers = authHeader(token);
  const res = await axios.get(`${API_BASE}/total-eval-amount`, { headers });
  return res.data;
};

export const getTotalAssets = async (token) => {
  const headers = authHeader(token);
  const res = await axios.get(`${API_BASE}/total`, { headers });
  return res.data;
};

export const getTotalProfitRate = async (token) => {
  const headers = authHeader(token);
  const res = await axios.get(`${API_BASE}/profit-rate`, { headers });
  return res.data;
};

export const getPortfolioAsset = async (token) => {
  const headers = authHeader(token);
  const res = await axios.get(`${API_BASE}/portfolio`, { headers });
  return res.data;
};
