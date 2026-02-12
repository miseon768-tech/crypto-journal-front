// api/assetPriceStream.js
import axios from "axios";
import { getStoredToken } from "./member";

const API_HOST = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
const API_BASE = `${API_HOST.replace(/\/$/, "")}/api/KRWAssets/summary`;

// ===== 토큰 헤더 생성 =====
const authHeader = (token) => {
    const t = getStoredToken(token);
    return t ? { Authorization: `Bearer ${t}` } : {};
};

// ===== 공통 GET =====
async function handleAxiosGet(url, token, config = {}) {
    try {
        const headers = { ...(config.headers || {}), ...authHeader(token) };
        const res = await axios.get(url, { ...config, headers });
        return res.data;
    } catch (err) {
        if (err.response) {
            throw {
                message: `GET ${url} failed with status ${err.response.status}`,
                status: err.response.status,
                body: err.response.data
            };
        }
        throw { message: `GET ${url} failed: ${err.message}` };
    }
}

// ===== API 함수 =====

export const getTotalAssets = async (token) => {
    try {
        const data = await handleAxiosGet(`${API_BASE}/total`, token);
        return data?.totalAssets ?? 0;
    } catch (e) {
        return (e.status === 403 || e.status === 404) ? 0 : (() => { throw e })();
    }
};

export const getTotalEvalAmount = async (token) => {
    try {
        const data = await handleAxiosGet(`${API_BASE}/total-eval-amount`, token);
        return data?.totalEvalAmount ?? 0;
    } catch (e) {
        return (e.status === 403 || e.status === 404) ? 0 : (() => { throw e })();
    }
};

export const getTotalProfit = async (token) => {
    try {
        const data = await handleAxiosGet(`${API_BASE}/profit/total`, token);
        return data?.totalProfit ?? 0;
    } catch (e) {
        return (e.status === 403 || e.status === 404) ? 0 : (() => { throw e })();
    }
};

export const getTotalProfitRate = async (token) => {
    try {
        const data = await handleAxiosGet(`${API_BASE}/profit-rate`, token);
        return data?.totalProfitRate ?? 0;
    } catch (e) {
        return (e.status === 403 || e.status === 404) ? 0 : (() => { throw e })();
    }
};

export const getPortfolioAsset = async (token) => {
    try {
        const data = await handleAxiosGet(`${API_BASE}/portfolio`, token);
        return data?.portfolioItemList ?? [];
    } catch (e) {
        return (e.status === 403 || e.status === 404) ? [] : (() => { throw e })();
    }
};

export const getCoinProfit = async (token, market) => {
    try {
        const data = await handleAxiosGet(`${API_BASE}/profit`, token, { params: { market } });
        return data?.profit ?? 0;
    } catch (e) {
        return (e.status === 403 || e.status === 404) ? 0 : (() => { throw e })();
    }
};

export const getCoinEvalAmount = async (token, market) => {
    try {
        const data = await handleAxiosGet(`${API_BASE}/eval-amount`, token, { params: { market } });
        return data?.evalAmount ?? 0;
    } catch (e) {
        return (e.status === 403 || e.status === 404) ? 0 : (() => { throw e })();
    }
};