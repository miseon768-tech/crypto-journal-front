import axios from "axios";
import { getStoredToken } from "./member";

const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080/api/assets";

// ===== 공통 요청 함수 =====
const handleRequest = async (method, url, token, data = null, config = {}) => {
    if (!token) throw new Error("토큰이 없습니다.");

    const t = getStoredToken(token);

    try {
        const res = await axios({
            method,
            url,
            data,
            ...config,
            headers: {
                Authorization: `Bearer ${t}`,
                ...(config.headers || {}),
            },
        });
        return res.data;
    } catch (err) {
        console.error(`${method.toUpperCase()} ${url} 실패`, err.response?.status, err.response?.data);
        throw err;
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