import axios from "axios";
import { getStoredToken } from "./member";

const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080/api/assets";

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

// 🔥 백엔드가 @RequestBody Long amount 받으므로
// 반드시 "숫자 단일 JSON" 형태로 보내야 함
export const upsertCashBalance = async (token, amount) => {
    const t = getStoredToken(token);

    const res = await axios({
        method: "post",
        url: `${API_BASE}/available-order-amount`,
        data: Number(amount), // 🔥 객체로 감싸지 않음
        headers: {
            "Content-Type": "application/json",
            ...(t ? { Authorization: `Bearer ${t}` } : {}),
        },
    });

    return res.data;
};


// 🔹 주문 가능 금액 조회
export const getCashBalance = (token) =>
    handleRequest("get", `${API_BASE}/available-order-amount`, token);