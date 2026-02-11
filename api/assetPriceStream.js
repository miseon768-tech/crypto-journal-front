// api/assetPriceStream.js
import axios from "axios";
import { getStoredToken } from "./member";

const API_HOST = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
const API_BASE = `${API_HOST.replace(/\/$/, "")}/api/KRWAssets/summary`;

// ===== 토큰 헤더 생성 =====
export const authHeader = (token) => {
    const t = getStoredToken(token);
    if (!t) return {};
    return { Authorization: `Bearer ${t}` };
};

async function handleAxiosGet(url, token, config = {}) {
    try {
        const headers = { ...(config.headers || {}), ...authHeader(token) };
        const res = await axios.get(url, { ...config, headers });
        return res;
    } catch (err) {
        if (err.response) {
            const status = err.response.status;
            const data = err.response.data;
            const message = `GET ${url} failed with status ${status} - ${JSON.stringify(data)}`;
            const e = new Error(message);
            e.status = status;
            e.body = data;
            throw e;
        }
        const e = new Error(`GET ${url} failed: ${err.message}`);
        throw e;
    }
}

// ===== API 함수 =====

export const getTotalAssets = async (token) => {
    try {
        const res = await handleAxiosGet(`${API_BASE}/total`, token);
        return res.data?.totalAssets ?? 0;
    } catch (e) {
        if (e.status === 403 || e.status === 404) return 0;
        throw e;
    }
};

export const getTotalEvalAmount = async (token) => {
    try {
        const res = await handleAxiosGet(`${API_BASE}/total-eval-amount`, token);
        return res.data?.totalEvalAmount ?? 0;
    } catch (e) {
        if (e.status === 403 || e.status === 404) return 0;
        throw e;
    }
};

export const getTotalProfit = async (token) => {
    try {
        const res = await handleAxiosGet(`${API_BASE}/profit/total`, token);
        return res.data?.totalProfit ?? 0;
    } catch (e) {
        if (e.status === 403 || e.status === 404) return 0;
        throw e;
    }
};

export const getTotalProfitRate = async (token) => {
    try {
        const res = await handleAxiosGet(`${API_BASE}/profit-rate`, token);
        return res.data?.totalProfitRate ?? 0;
    } catch (e) {
        if (e.status === 403 || e.status === 404) return 0;
        throw e;
    }
};

export const getPortfolioAsset = async (token) => {
    try {
        const res = await handleAxiosGet(`${API_BASE}/portfolio`, token);
        return res.data?.portfolioItemList ?? [];
    } catch (e) {
        if (e.status === 403 || e.status === 404) return [];
        throw e;
    }
};

export const getCoinProfit = async (token, market) => {
    try {
        const res = await handleAxiosGet(`${API_BASE}/profit`, token, { params: { market } });
        return res.data?.profit ?? 0;
    } catch (e) {
        if (e.status === 403 || e.status === 404) return 0;
        throw e;
    }
};

export const getCoinEvalAmount = async (token, market) => {
    try {
        const res = await handleAxiosGet(`${API_BASE}/eval-amount`, token, { params: { market } });
        return res.data?.evalAmount ?? 0;
    } catch (e) {
        if (e.status === 403 || e.status === 404) return 0;
        throw e;
    }
};