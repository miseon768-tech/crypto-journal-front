import { getStoredToken } from "./member"; // 토큰 가져오는 함수

const API_BASE = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"}/api/assets/favorites`;

// 인증 헤더
const authHeader = (token) => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
});

// 관심 코인 추가
export const addFavoriteCoin = async (coinInput, token = getStoredToken()) => {
    const res = await fetch(API_BASE, {
        method: "POST",
        headers: authHeader(token),
        body: JSON.stringify(coinInput),
    });
    if (!res.ok) throw new Error("관심 코인 추가 실패");
    return res.json();
};

// 관심 코인 조회
export const getFavoriteCoins = async (token = getStoredToken()) => {
    const res = await fetch(API_BASE, {
        headers: authHeader(token),
    });
    if (!res.ok) throw new Error("관심 코인 조회 실패");
    return res.json();
};

// 선택 삭제
export const deleteFavoriteCoin = async (ids, token = getStoredToken()) => {
    const res = await fetch(`${API_BASE}/select`, {
        method: "DELETE",
        headers: authHeader(token),
        body: JSON.stringify(ids),
    });
    if (!res.ok) throw new Error("선택 삭제 실패");
    return res.json();
};

// 전체 삭제
export const deleteAllFavoriteCoins = async (token = getStoredToken()) => {
    const res = await fetch(API_BASE, {
        method: "DELETE",
        headers: authHeader(token),
    });
    if (!res.ok) throw new Error("전체 삭제 실패");
    return res.json();
};