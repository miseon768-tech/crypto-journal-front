import axios from "axios";

// 로컬 테스트 시 API 주소가 정확한지 보세요 (localhost:8080)
const API_HOST = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080").replace(/\/$/, "");
const API_BASE = `${API_HOST}/api/KRWAssets/summary`;

const handleGet = async (url, token, config = {}) => {
    if (!token) return null; // 토큰 없으면 에러 던지지 말고 조용히 리턴

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
        // 로컬 디버깅을 위해 로그만 남기고, 에러를 던지지(throw) 않습니다.
        console.warn(`⚠️ API 호출 실패 (${url}):`, err.response?.status || err.message);
        return null;
    }
};

// 모든 함수에서 에러를 throw 하지 않고, 안전하게 0이나 빈 배열을 반환하도록 합니다.
export const getTotalAssets = async (token) => {
    const data = await handleGet(`${API_BASE}/total`, token);
    return data?.totalAssets ?? 0;
};

export const getTotalEvalAmount = async (token) => {
    const data = await handleGet(`${API_BASE}/total-eval-amount`, token);
    return data?.totalEvalAmount ?? 0;
};

export const getTotalProfit = async (token) => {
    const data = await handleGet(`${API_BASE}/profit/total`, token);
    return data?.totalProfit ?? 0;
};

export const getTotalProfitRate = async (token) => {
    const data = await handleGet(`${API_BASE}/profit-rate`, token);
    return data?.totalProfitRate ?? 0;
};

export const getPortfolioAsset = async (token) => {
    const data = await handleGet(`${API_BASE}/portfolio`, token);
    if (!data) return [];
    return data.portfolioItemList || data.portfolio || (Array.isArray(data) ? data : []);
};

export const getCoinProfit = async (token, market) => {
    const data = await handleGet(`${API_BASE}/profit`, token, { params: { market } });
    return data?.profit ?? 0;
};

export const getCoinEvalAmount = async (token, market) => {
    const data = await handleGet(`${API_BASE}/eval-amount`, token, { params: { market } });
    return data?.evalAmount ?? 0;
};