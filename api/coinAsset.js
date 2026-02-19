import { getStoredToken } from "./member";

const API_BASE = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"}/api/coin/assets`;

// 토큰 기반 Authorization 헤더
const authHeader = (token) => (token ? { Authorization: `Bearer ${token}` } : {});

// ===== 모든 코인 자산 조회 =====
export const getAllCoinAssets = async (token = getStoredToken()) => {
    try {
        console.log("🔵 코인 자산 조회 시작:", API_BASE);
        console.log("🔵 토큰:", token ? "있음" : "없음");

        const res = await fetch(API_BASE, {
            headers: authHeader(token)
        });

        console.log("🔵 응답 상태:", res.status);

        if (!res.ok) {
            // 404는 자산이 없는 경우
            if (res.status === 404) {
                console.log("⚠️ 자산 없음 (404)");
                return [];
            }

            // 에러 응답 본문 읽기
            const errorText = await res.text();
            console.error("❌ 에러 응답:", errorText);

            let errorMessage = "코인 자산 조회 실패";
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.message || errorJson.error || errorMessage;
            } catch (e) {
                errorMessage = errorText || errorMessage;
            }

            throw new Error(`${errorMessage} (HTTP ${res.status})`);
        }

        const data = await res.json();
        console.log("✅ 응답 데이터:", data);

        // 백엔드 응답: CoinAssetListResponse { coinAssets: [...], success: true }
        const assets = data.coinAssets || data || [];
        console.log("✅ 파싱된 자산:", assets);

        return assets;
    } catch (error) {
        console.error("❌ getAllCoinAssets 에러:", error);
        throw error;
    }
};

// ===== 코인 자산 생성 =====
export const createCoinAsset = async (market, buyAmount, token = getStoredToken()) => {
    try {
        console.log("🔵 코인 자산 생성:", { market, buyAmount });

        const res = await fetch(API_BASE, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...authHeader(token)
            },
            body: JSON.stringify({ market, buyAmount }),
        });

        console.log("🔵 생성 응답 상태:", res.status);

        if (!res.ok) {
            const errorText = await res.text();
            console.error("❌ 생성 에러:", errorText);

            let errorMessage = "코인 자산 생성 실패";
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.message || errorJson.error || errorMessage;
            } catch (e) {
                errorMessage = errorText || errorMessage;
            }

            throw new Error(`${errorMessage} (HTTP ${res.status})`);
        }

        const data = await res.json();
        console.log("✅ 생성 성공:", data);
        return data;
    } catch (error) {
        console.error("❌ createCoinAsset 에러:", error);
        throw error;
    }
};

// ===== 코인 자산 삭제 =====
export const deleteCoinAsset = async (assetId, token = getStoredToken()) => {
    try {
        console.log("🔵 코인 자산 삭제:", assetId);

        const res = await fetch(`${API_BASE}/${assetId}`, {
            method: "DELETE",
            headers: authHeader(token),
        });

        console.log("🔵 삭제 응답 상태:", res.status);

        if (!res.ok) {
            const errorText = await res.text();
            console.error("❌ 삭제 에러:", errorText);

            let errorMessage = "코인 자산 삭제 실패";
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.message || errorJson.error || errorMessage;
            } catch (e) {
                errorMessage = errorText || errorMessage;
            }

            throw new Error(`${errorMessage} (HTTP ${res.status})`);
        }

        const data = await res.json();
        console.log("✅ 삭제 성공:", data);
        return data;
    } catch (error) {
        console.error("❌ deleteCoinAsset 에러:", error);
        throw error;
    }
};

// ===== 트레이딩 페어로 자산 검색 =====
export const getAssetByTradingPair = async (tradingPairId, token = getStoredToken()) => {
    const res = await fetch(`${API_BASE}/${tradingPairId}`, {
        headers: authHeader(token)
    });
    if (!res.ok) throw new Error("자산 조회 실패");
    return res.json();
};

// ===== 마켓으로 자산 검색 =====
export const getAssetByMarket = async (market, token = getStoredToken()) => {
    const res = await fetch(`${API_BASE}/market?market=${encodeURIComponent(market)}`, {
        headers: authHeader(token)
    });
    if (!res.ok) throw new Error("자산 조회 실패");
    return res.json();
};

// ===== 한글명으로 자산 검색 =====
export const getAssetByKorean = async (name, token = getStoredToken()) => {
    const res = await fetch(`${API_BASE}/korean?koreanName=${encodeURIComponent(name)}`, {
        headers: authHeader(token)
    });
    if (!res.ok) throw new Error("자산 조회 실패");
    return res.json();
};

// ===== 영문명으로 자산 검색 =====
export const getAssetByEnglish = async (name, token = getStoredToken()) => {
    const res = await fetch(`${API_BASE}/english?englishName=${encodeURIComponent(name)}`, {
        headers: authHeader(token)
    });
    if (!res.ok) throw new Error("자산 조회 실패");
    return res.json();
};

// ===== 카테고리로 자산 검색 =====
export const getAssetByCategory = async (params, token = getStoredToken()) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/category?${query}`, {
        headers: authHeader(token)
    });
    if (!res.ok) throw new Error("자산 조회 실패");
    return res.json();
};

// ===== 코인 매수 금액 입력/수정 =====
export const upsertCoinBuyAmount = async (market, amount, token = getStoredToken()) => {
    try {
        console.log("🔵 매수 금액 수정:", { market, amount });

        const res = await fetch(`${API_BASE}/purchase-by-coin`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...authHeader(token)
            },
            body: JSON.stringify({ market, amount }),
        });

        console.log("🔵 수정 응답 상태:", res.status);

        if (!res.ok) {
            const errorText = await res.text();
            console.error("❌ 수정 에러:", errorText);

            let errorMessage = "매수금액 입력 실패";
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.message || errorJson.error || errorMessage;
            } catch (e) {
                errorMessage = errorText || errorMessage;
            }

            throw new Error(`${errorMessage} (HTTP ${res.status})`);
        }

        const data = await res.json();
        console.log("✅ 수정 성공:", data);
        return data;
    } catch (error) {
        console.error("❌ upsertCoinBuyAmount 에러:", error);
        throw error;
    }
};

// ===== 코인 매수 금액 조회 =====
export const getCoinBuyAmount = async (market, token = getStoredToken()) => {
    const res = await fetch(`${API_BASE}/purchase-by-coin?market=${encodeURIComponent(market)}`, {
        headers: authHeader(token)
    });

    if (!res.ok) throw new Error("매수금액 조회 실패");

    const data = await res.json();
    return data.amount || 0;
};

// ===== 총 매수금액 조회 =====
export const getTotalCoinBuyAmount = async (token = getStoredToken()) => {
    const res = await fetch(`${API_BASE}/total-purchase-amount`, {
        headers: authHeader(token)
    });

    if (!res.ok) throw new Error("총 매수금액 조회 실패");

    const data = await res.json();
    return data.totalBuyAmount || 0;
};