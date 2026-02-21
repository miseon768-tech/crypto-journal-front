import { getStoredToken } from "./member";

const API_BASE = `${
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"
}/api/coin/assets`;

// 토큰 기반 Authorization 헤더
const authHeader = (token) => (token ? { Authorization: `Bearer ${token}` } : {});

// 공통 에러 파서
const parseError = async (res) => {
    const errorText = await res.text();
    try {
        const j = JSON.parse(errorText);
        return j?.message || j?.error || errorText;
    } catch {
        return errorText || `HTTP ${res.status}`;
    }
};

// 숫자 파싱 유틸: "", null, undefined, NaN -> null / 그 외 유효 숫자만 number로
const toNumberOrNull = (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
};

// =====================================================
// ✅ 1) 모든 코인 자산 조회 (GET /api/coin/assets)
// =====================================================
export const getAllCoinAssets = async (token = getStoredToken()) => {
    const res = await fetch(API_BASE, { headers: authHeader(token) });

    if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error(`${await parseError(res)} (HTTP ${res.status})`);
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
};

// =====================================================
// ✅ 2) 코인 자산 등록 (POST /api/coin/assets)
// 정책: buyAmount는 서버에서 (coinBalance * avgBuyPrice)로 자동 계산
// body: { market, coinBalance, avgBuyPrice }
// =====================================================
export const createCoinAsset = async (
    { market, coinBalance, avgBuyPrice },
    token = getStoredToken()
) => {
    const payload = {
        market,
        coinBalance: toNumberOrNull(coinBalance),
        avgBuyPrice: toNumberOrNull(avgBuyPrice),
    };

    const res = await fetch(API_BASE, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...authHeader(token),
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        throw new Error(`${await parseError(res)} (HTTP ${res.status})`);
    }

    return res.json();
};

// =====================================================
// ✅ 3) 코인 자산 수정 (PUT /api/coin/assets)
// 정책: buyAmount는 서버에서 (coinBalance * avgBuyPrice)로 자동 계산
// body: { market, coinBalance, avgBuyPrice }
// =====================================================
export const updateCoinAsset = async (
    { market, coinBalance, avgBuyPrice },
    token = getStoredToken()
) => {
    const payload = {
        market,
        coinBalance: toNumberOrNull(coinBalance),
        avgBuyPrice: toNumberOrNull(avgBuyPrice),
    };

    const res = await fetch(API_BASE, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...authHeader(token),
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        throw new Error(`${await parseError(res)} (HTTP ${res.status})`);
    }

    return res.json();
};

// =====================================================
// ✅ 4) 코인 자산 삭제 (DELETE /api/coin/assets?market=KRW-BTC)
// =====================================================
export const deleteCoinAsset = async (market, token = getStoredToken()) => {
    const res = await fetch(`${API_BASE}?market=${encodeURIComponent(market)}`, {
        method: "DELETE",
        headers: authHeader(token),
    });

    if (!res.ok) {
        throw new Error(`${await parseError(res)} (HTTP ${res.status})`);
    }

    return true;
};

// =====================================================
// ✅ 5) 트레이딩 페어로 자산 검색
// GET /api/coin/assets/{tradingPairId}
// =====================================================
export const getAssetByTradingPair = async (
    tradingPairId,
    token = getStoredToken()
) => {
    const res = await fetch(`${API_BASE}/${tradingPairId}`, {
        headers: authHeader(token),
    });
    if (!res.ok) throw new Error("자산 조회 실패");
    return res.json();
};

// GET /api/coin/assets/market?market=...
export const getAssetByMarket = async (market, token = getStoredToken()) => {
    const res = await fetch(
        `${API_BASE}/market?market=${encodeURIComponent(market)}`,
        { headers: authHeader(token) }
    );
    if (!res.ok) throw new Error("자산 조회 실패");
    return res.json();
};

// GET /api/coin/assets/korean?koreanName=...
export const getAssetByKorean = async (name, token = getStoredToken()) => {
    const res = await fetch(
        `${API_BASE}/korean?koreanName=${encodeURIComponent(name)}`,
        { headers: authHeader(token) }
    );
    if (!res.ok) throw new Error("자산 조회 실패");
    return res.json();
};

// GET /api/coin/assets/english?englishName=...
export const getAssetByEnglish = async (name, token = getStoredToken()) => {
    const res = await fetch(
        `${API_BASE}/english?englishName=${encodeURIComponent(name)}`,
        { headers: authHeader(token) }
    );
    if (!res.ok) throw new Error("자산 조회 실패");
    return res.json();
};

// GET /api/coin/assets/category?... (기존 그대로)
export const getAssetByCategory = async (params, token = getStoredToken()) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/category?${query}`, {
        headers: authHeader(token),
    });
    if (!res.ok) throw new Error("자산 조회 실패");
    return res.json();
};

// =====================================================
// ✅ 6) 총 매수금액 조회
// GET /api/coin/assets/total-purchase-amount
// 응답: { success, totalBuyAmount }
// =====================================================
export const getTotalCoinBuyAmount = async (token = getStoredToken()) => {
    const res = await fetch(`${API_BASE}/total-purchase-amount`, {
        headers: authHeader(token),
    });

    if (!res.ok) throw new Error("총 매수금액 조회 실패");

    const data = await res.json();
    return data?.totalBuyAmount ?? 0;
};