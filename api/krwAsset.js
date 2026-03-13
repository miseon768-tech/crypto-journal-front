import axios from "axios";
import { getStoredToken } from "./member";

// ✅ 환경변수 우선순위:
// 1) NEXT_PUBLIC_KRW_API_BASE (완전한 assets API 주소를 직접 지정)
// 2) NEXT_PUBLIC_BACKEND_URL (백엔드 호스트) + /api/assets
// 3) localhost 기본값
const BACKEND_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080").replace(/\/$/, "");
const API_BASE = (
    process.env.NEXT_PUBLIC_KRW_API_BASE ||
    `${BACKEND_BASE}/api/assets`
).replace(/\/$/, "");

/**
 * 공통 요청 함수
 */
const handleRequest = async (method, url, token, data = null) => {
    const t = getStoredToken(token);

    try {
        const res = await axios({
            method,
            url,
            data,
            headers: {
                "Content-Type": "application/json",
                ...(t ? { Authorization: `Bearer ${t}` } : {}),
            },
        });

        return res.data;
    } catch (err) {
        const status = err.response?.status;
        const body = err.response?.data;
        const message =
            body?.message ||
            body?.error ||
            err.message ||
            `HTTP ${status}`;

        const e = new Error(message);
        e.status = status;
        e.body = body;
        throw e;
    }
};

// =============================
//        자산 API
// =============================

// 🔹 자산 추가
export const addAsset = (token, assetData) =>
    handleRequest("post", API_BASE, token, assetData);

// 🔹 자산 수정
export const updateAsset = (token, assetId, assetData) =>
    handleRequest("put", `${API_BASE}/${assetId}`, token, assetData);

// 🔹 자산 삭제
export const deleteAsset = (token, assetId) =>
    handleRequest("delete", `${API_BASE}/${assetId}`, token);

// 🔹 자산 조회
export const getAssets = (token) =>
    handleRequest("get", API_BASE, token);

// =============================
//     주문 가능 금액 API
// =============================

// 🔥 주문 가능 금액 등록/수정
export const upsertCashBalance = async (token, amount) => {
    const t = getStoredToken(token);

    try {
        const res = await axios({
            method: "post",
            url: `${API_BASE}/available-order-amount`,
            data: Number(amount),
            headers: {
                "Content-Type": "application/json",
                ...(t ? { Authorization: `Bearer ${t}` } : {}),
            },
        });

        console.log("✅ upsertCashBalance 성공:", res.data);
        return res.data;
    } catch (err) {
        console.error("❌ upsertCashBalance 실패:", err.response?.data || err);
        throw err;
    }
};

// 🔹 주문 가능 금액 조회
export const getCashBalance = async (token) => {
    try {
        const result = await handleRequest("get", `${API_BASE}/available-order-amount`, token);
        console.log("✅ getCashBalance 성공:", result);
        return result;
    } catch (err) {
        console.error("❌ getCashBalance 실패:", err);
        throw err;
    }
};