import axios from "axios";
import { getStoredToken } from "./member";

const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080/api/assets";

// ===== 공통 요청 함수 =====
const handleRequest = async (method, url, token, data = null, config = {}) => {
    // try to normalize/extract token from provided value or localStorage
    const t = getStoredToken(token);
    if (!t) {
        // If no token available, only allow non-auth GETs; otherwise throw
        // But for clarity, let request proceed with no Authorization header and let backend respond 401/403.
        // This avoids frontend throwing before network error and allows caller to handle backend message.
        // We'll set authHeader only if token exists.
    }

    try {
        const res = await axios({
            method,
            url,
            data,
            ...config,
            headers: {
                ...(config.headers || {}),
                ...(t ? { Authorization: `Bearer ${t}` } : {}),
            },
        });
        return res.data;
    } catch (err) {
        console.error(`${method.toUpperCase()} ${url} 실패`, err.response?.status, err.response?.data);
        // normalize axios error to throw a clear Error with status where possible
        const status = err.response?.status;
        const body = err.response?.data;
        const message = (body && (body.message || body.error)) || err.message || `HTTP ${status}`;
        const e = new Error(message);
        e.status = status;
        e.body = body;
        throw e;
    }
};

// ===== 자산 API =====

// 자산 추가
export const addAsset = (token, assetData) => handleRequest("post", API_BASE, token, assetData);

// 자산 수정
export const updateAsset = (token, assetId, assetData) =>
    handleRequest("put", `${API_BASE}/${assetId}`, token, assetData);

// 자산 삭제
export const deleteAsset = (token, assetId) =>
    handleRequest("delete", `${API_BASE}/${assetId}`, token);

// 자산 조회
export const getAssets = (token) => handleRequest("get", API_BASE, token);

// 주문 가능 금액 입력/수정
export const upsertCashBalance = (token, amount) =>
    handleRequest("post", `${API_BASE}/available-order-amount`, token, amount);

// 주문 가능 금액 조회
export const getCashBalance = (token) =>
    handleRequest("get", `${API_BASE}/available-order-amount`, token);