import axios from "axios";
import { getStoredToken } from "./member";

const API_HOST = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://43.201.97.58.nip.io:8081").replace(/\/$/, "");

const API_BASE = `${API_HOST}/api/KRWAssets/summary`;

// ===== 공통 GET 함수 =====
const handleGet = async (url, token, config = {}) => {
    if (!token) throw new Error("토큰이 없습니다.");

    // token 그대로 사용
    try {
        const res = await axios.get(url, {
            ...config,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(config.headers || {}),
            },
        });
        return res.data;
    } catch (err) {
        const status = err.response?.status;
        const data = err.response?.data;
        console.error(`GET ${url} 실패`, status, data);
        const message =
            (data?.message ?? data?.error ?? (data ? JSON.stringify(data) : undefined))
            || err.message
            || `HTTP ${status}`;
        const e = new Error(message);
        e.status = status;
        e.body = data;
        throw e;
    }
};

// ===== Summary API =====
export const getTotalAssets = async (token) => {
    try {
        const data = await handleGet(`${API_BASE}/total`, token);
        // 백엔드 응답은 { totalAssets: number, success: boolean }
        if (data && typeof data === 'object' && data.totalAssets !== undefined) return data.totalAssets;
        return typeof data === 'number' ? data : 0;
    } catch (e) {
        // 백에서 자산 없음 같은 메시지를 주면 0으로 안전하게 반환
        const msg = String(e?.message || '').toLowerCase();
        if (e?.status === 404 || msg.includes('자산 없음') || msg.includes('코인 자산 없음')) return 0;
        throw e;
    }
};

export const getTotalEvalAmount = async (token) => {
    try {
        const data = await handleGet(`${API_BASE}/total-eval-amount`, token);
        if (data && typeof data === 'object' && data.totalEvalAmount !== undefined) return data.totalEvalAmount;
        return typeof data === 'number' ? data : 0;
    } catch (e) {
        const msg = String(e?.message || '').toLowerCase();
        if (e?.status === 404 || msg.includes('자산 없음') || msg.includes('코인 자산 없음')) return 0;
        throw e;
    }
};

export const getTotalProfit = async (token) => {
    try {
        const data = await handleGet(`${API_BASE}/profit/total`, token);
        if (data && typeof data === 'object' && data.totalProfit !== undefined) return data.totalProfit;
        return typeof data === 'number' ? data : 0;
    } catch (e) {
        const msg = String(e?.message || '').toLowerCase();
        // 백이 "코인 자산 없음" 등으로 응답하면 0으로 처리
        if (e?.status === 404 || msg.includes('자산 없음') || msg.includes('코인 자산 없음')) return 0;
        throw e;
    }
};

export const getTotalProfitRate = async (token) => {
    try {
        const data = await handleGet(`${API_BASE}/profit-rate`, token);
        if (data && typeof data === 'object' && data.totalProfitRate !== undefined) return data.totalProfitRate;
        return typeof data === 'number' ? data : 0;
    } catch (e) {
        const msg = String(e?.message || '').toLowerCase();
        if (e?.status === 404 || msg.includes('자산 없음') || msg.includes('코인 자산 없음')) return 0;
        throw e;
    }
};

export const getPortfolioAsset = async (token) => {
    try {
        const data = await handleGet(`${API_BASE}/portfolio`, token);
        // 백은 { portfolioItemList: [...] , success: true } 형태로 응답할 수 있음
        if (data && typeof data === 'object') {
            if (Array.isArray(data)) return data;
            if (data.portfolioItemList) return data.portfolioItemList;
            if (data.portfolio) return data.portfolio;
            if (data.data) return data.data;
        }
        return Array.isArray(data) ? data : [];
    } catch (e) {
        const msg = String(e?.message || '').toLowerCase();
        if (e?.status === 404 || msg.includes('자산 없음') || msg.includes('코인 자산 없음')) return [];
        throw e;
    }
};

export const getCoinProfit = async (token, market) => {
    try {
        const data = await handleGet(`${API_BASE}/profit`, token, { params: { market } });
        if (data && typeof data === 'object' && data.profit !== undefined) return data.profit;
        return typeof data === 'number' ? data : 0;
    } catch (e) {
        const msg = String(e?.message || '').toLowerCase();
        if (e?.status === 404 || msg.includes('자산 없음') || msg.includes('코인 자산 없음')) return 0;
        throw e;
    }
};

export const getCoinEvalAmount = async (token, market) => {
    try {
        const data = await handleGet(`${API_BASE}/eval-amount`, token, { params: { market } });
        if (data && typeof data === 'object' && data.evalAmount !== undefined) return data.evalAmount;
        return typeof data === 'number' ? data : 0;
    } catch (e) {
        const msg = String(e?.message || '').toLowerCase();
        if (e?.status === 404 || msg.includes('자산 없음') || msg.includes('코인 자산 없음')) return 0;
        throw e;
    }
};
