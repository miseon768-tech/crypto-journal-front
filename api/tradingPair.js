import axios from "axios";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080/api/market";

// 모든 마켓(트레이딩 페어) 조회
export const getAllMarkets = async () => {
  const res = await axios.get(`${API_BASE}/all`);
  return res.data;
};
