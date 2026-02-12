import axios from "axios";
import { getStoredToken } from "./member";

const API_HOST =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

const API_BASE = `${API_HOST}/api/KRWAssets/summary`;

// ===== 공통 GET 함수 =====
const handleGet = async (url, token, config = {}) => {
    if (!token) throw new Error("토큰이 없습니다.");

    const t = getStoredToken(token);

    try {
        const res = await axios.get(url, {
            ...config,
            headers: {
                Authorization: `Bearer ${t}`,
                ...(config.headers || {}),
            },
        });
        return res.data;
    } catch (err) {
        console.error(`GET ${url} 실패`, err.response?.status, err.response?.data);
        throw err;
    }
};

// ===== Summary API =====
export const getTotalAssets = (token) => handleGet(`${API_BASE}/total`, token);

export const getTotalEvalAmount = (token) =>
    handleGet(`${API_BASE}/total-eval-amount`, token);

export const getTotalProfit = (token) =>
    handleGet(`${API_BASE}/profit/total`, token);

export const getTotalProfitRate = (token) =>
    handleGet(`${API_BASE}/profit-rate`, token);

export const getPortfolioAsset = (token) =>
    handleGet(`${API_BASE}/portfolio`, token);

export const getCoinProfit = (token, market) =>
    handleGet(`${API_BASE}/profit`, token, { params: { market } });

export const getCoinEvalAmount = (token, market) =>
    handleGet(`${API_BASE}/eval-amount`, token, { params: { market } });