// api/coinAsset.js
import { getStoredToken } from "./member"; // 토큰 가져오는 함수

const API_BASE = "http://localhost:8080/api/coin/assets";

// 토큰 기반 Authorization 헤더
const authHeader = (token) => (token ? { Authorization: `Bearer ${token}` } : {});

// 자산 검색
export const getAssetByTradingPair = async (tradingPairId, token = getStoredToken()) => {
    const res = await fetch(`${API_BASE}/${tradingPairId}`, { headers: authHeader(token) });
    if (!res.ok) throw new Error("자산 조회 실패");
    return res.json();
};

export const getAssetByMarket = async (market, token = getStoredToken()) => {
    const res = await fetch(`${API_BASE}/market?market=${market}`, { headers: authHeader(token) });
    if (!res.ok) throw new Error("자산 조회 실패");
    return res.json();
};

export const getAssetByKorean = async (name, token = getStoredToken()) => {
    const res = await fetch(`${API_BASE}/korean?koreanName=${name}`, { headers: authHeader(token) });
    if (!res.ok) throw new Error("자산 조회 실패");
    return res.json();
};

export const getAssetByEnglish = async (name, token = getStoredToken()) => {
    const res = await fetch(`${API_BASE}/english?englishName=${name}`, { headers: authHeader(token) });
    if (!res.ok) throw new Error("자산 조회 실패");
    return res.json();
};

export const getAssetByCategory = async (params, token = getStoredToken()) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/category?${query}`, { headers: authHeader(token) });
    if (!res.ok) throw new Error("자산 조회 실패");
    return res.json();
};

// 매수금액 입력
export const upsertCoinBuyAmount = async (amount, token = getStoredToken()) => {
    const res = await fetch(`${API_BASE}/purchase-by-coin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader(token) },
        body: JSON.stringify(amount),
    });
    if (!res.ok) throw new Error("매수금액 입력 실패");
    return res.json();
};

// 매수금액 조회
export const getCoinBuyAmount = async (token = getStoredToken()) => {
    const res = await fetch(`${API_BASE}/purchase-by-coin`, { headers: authHeader(token) });
    if (!res.ok) throw new Error("매수금액 조회 실패");
    return res.json();
};

// 총 매수금액 조회
export const getTotalCoinBuyAmount = async (token = getStoredToken()) => {
    const res = await fetch(`${API_BASE}/total-purchase-amount`, { headers: authHeader(token) });
    if (!res.ok) throw new Error("총 매수금액 조회 실패");
    return res.json();
};