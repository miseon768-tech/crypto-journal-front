// api/assetPriceStream.js
import axios from "axios";

const API_BASE = "http://localhost:8080/api/KRWAssets/summary";

// ===== 토큰 헤더 생성 =====
export const authHeader = (token) => {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
};

// ===== API 함수 =====

// 총 보유자산 조회
export const getTotalAssets = async (token) => {
    const res = await axios.get(`${API_BASE}/total`, { headers: authHeader(token) });
    return res.data.totalAssets; // 백엔드 Response 구조 기준
};

// 총 평가금액 조회
export const getTotalEvalAmount = async (token) => {
    const res = await axios.get(`${API_BASE}/total-eval-amount`, { headers: authHeader(token) });
    return res.data.totalEvalAmount;
};

// 총 평가손익 조회
export const getTotalProfit = async (token) => {
    const res = await axios.get(`${API_BASE}/profit/total`, { headers: authHeader(token) });
    return res.data.totalProfit;
};

// 총 수익률 조회
export const getTotalProfitRate = async (token) => {
    const res = await axios.get(`${API_BASE}/profit-rate`, { headers: authHeader(token) });
    return res.data.totalProfitRate;
};

// 보유자산 포트폴리오 조회
export const getPortfolioAsset = async (token) => {
    const res = await axios.get(`${API_BASE}/portfolio`, { headers: authHeader(token) });
    return res.data.portfolioItemList; // list 형태
};

// 코인별 평가손익 조회 (market 필요)
export const getCoinProfit = async (token, market) => {
    const res = await axios.get(`${API_BASE}/profit`, {
        headers: authHeader(token),
        params: { market }
    });
    return res.data.profit;
};

// 코인별 평가금액 조회 (market 필요)
export const getCoinEvalAmount = async (token, market) => {
    const res = await axios.get(`${API_BASE}/eval-amount`, {
        headers: authHeader(token),
        params: { market }
    });
    return res.data.evalAmount;
};