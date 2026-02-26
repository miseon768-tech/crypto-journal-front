import axios from "axios";
import { getStoredToken } from "./member";

const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE || "http://43.201.97.58.nip.io:8081/api/market";

// Robust JWT 유효성 검사 함수
function resolveToken(token) {
    if (!token || typeof token !== "string") return null;
    const t = token.trim();
    // 아래 값들은 모두 잘못된 토큰임
    if (!t || t === "undefined" || t === "null") return null;
    return t;
}

// 인증 실패시 자동 로그아웃 및 페이지 이동 지원
function handleAuthFailure(router) {
    alert("로그인 정보가 만료되었거나 인증 오류입니다. 다시 로그인 해주세요.");
    localStorage.removeItem("token");
    if (router && typeof router.push === "function") {
        router.push("/login");
    }
}

export const getAllMarkets = async (router) => {
    const rawToken = localStorage.getItem("token");
    const token = resolveToken(rawToken);

    const headers = token
        ? { Authorization: `Bearer ${token}` }
        : {};

    try {
        const res = await axios.get(`${API_BASE}/all`, {
            headers,
        });
        return res.data;
    } catch (err) {
        if (err.response && err.response.status === 401) {
            handleAuthFailure(router);
        } else {
            alert("네트워크 또는 서버 오류");
        }
        throw err;
    }
};