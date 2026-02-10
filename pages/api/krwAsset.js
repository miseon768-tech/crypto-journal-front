import axios from "axios";
import { getStoredToken } from './_client';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080/api/assets";

// 자산 추가
export const addAsset = async (token, assetData) => {
  const t = getStoredToken(token);
  const res = await axios.post(API_BASE, assetData, {
    headers: { Authorization: `Bearer ${t}` },
  });
  return res.data;
};

// 자산 수정
export const updateAsset = async (token, assetId, assetData) => {
  const t = getStoredToken(token);
  const res = await axios.put(`${API_BASE}/${assetId}`, assetData, {
    headers: { Authorization: `Bearer ${t}` },
  });
  return res.data;
};

// 자산 삭제
export const deleteAsset = async (token, assetId) => {
  const t = getStoredToken(token);
  const res = await axios.delete(`${API_BASE}/${assetId}`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  return res.data;
};

// 자산 조회
export const getAssets = async (token) => {
  const t = getStoredToken(token);
  const res = await axios.get(API_BASE, {
    headers: { Authorization: `Bearer ${t}` },
  });
  return res.data;
};

// 주문 가능 금액 입력/수정
export const upsertCashBalance = async (token, amount) => {
  const t = getStoredToken(token);
  const res = await axios.post(`${API_BASE}/available-order-amount`, amount, {
    headers: { Authorization: `Bearer ${t}` },
  });
  return res.data;
};

// 주문 가능 금액 조회
export const getCashBalance = async (token) => {
  const t = getStoredToken(token);
  const res = await axios.get(`${API_BASE}/available-order-amount`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  return res.data;
};
