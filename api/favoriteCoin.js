import { getStoredToken } from "./member";

const API_BASE = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"}/api/assets/favorites`;

// 인증 헤더
const authHeader = (token) => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
});

// 관심 코인 추가
export const addFavoriteCoin = async (coinInput, token = getStoredToken()) => {
    if (!token) throw new Error("토큰 없음: 관심 코인 추가 불가");
    const res = await fetch(API_BASE, {
        method: "POST",
        headers: authHeader(token),
        body: JSON.stringify(coinInput),
    });
    if (!res.ok) throw new Error(`관심 코인 추가 실패 (status: ${res.status})`);
    return res.json();
};

// 관심 코인 조회
export const getFavoriteCoins = async (token = getStoredToken()) => {
    if (!token) {
        console.warn("토큰 없음: 관심 코인 조회 불가");
        return [];
    }

    try {
        const res = await fetch(API_BASE, {
            headers: authHeader(token),
        });

        // 관심 코인이 없으면 빈 배열 반환
        if (res.status === 404) return [];

        if (!res.ok) {
            const errJson = await res.json().catch(() => null);
            throw new Error(`관심 코인 조회 실패 (status: ${res.status}) | message: ${JSON.stringify(errJson)}`);
        }

        return await res.json();
    } catch (e) {
        console.error("관심 코인 조회 중 오류", e);
        return [];
    }
};

// 선택 삭제
export const deleteFavoriteCoin = async (ids, token = getStoredToken()) => {
    if (!token) throw new Error("토큰 없음: 선택 삭제 불가");
    const res = await fetch(`${API_BASE}/select`, {
        method: "DELETE",
        headers: authHeader(token),
        body: JSON.stringify(ids),
    });
    if (!res.ok) throw new Error(`선택 삭제 실패 (status: ${res.status})`);
    return res.json();
};

// 전체 삭제
export const deleteAllFavoriteCoins = async (token = getStoredToken()) => {
    if (!token) throw new Error("토큰 없음: 전체 삭제 불가");
    const res = await fetch(API_BASE, {
        method: "DELETE",
        headers: authHeader(token),
    });
    if (!res.ok) throw new Error(`전체 삭제 실패 (status: ${res.status})`);
    return res.json();
};