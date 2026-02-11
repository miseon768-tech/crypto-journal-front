// api/post.js
const API_HOST = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080").replace(/\/$/, '');
const API_BASE = `${API_HOST}/api/post`;
import { getStoredToken } from './member';

// ------------------------
// 안전한 JSON 파싱
// ------------------------
async function safeJson(res) {
    try {
        return await res.json();
    } catch {
        return null;
    }
}

// ------------------------
// 헤더 생성
// ------------------------
function makeHeaders(token, json = true) {
    const headers = {};
    if (json) headers['Content-Type'] = 'application/json';

    const tokenStr = token || getStoredToken();
    if (tokenStr) headers['Authorization'] = `Bearer ${tokenStr}`;

    return headers;
}

// ------------------------
// 공통 fetch 처리
// ------------------------
async function handleFetch(url, options = {}, fallbackMsg = "API 요청 실패") {
    try {
        const res = await fetch(url, options);
        let data = null;

        try {
            data = await res.json();
        } catch {
            data = null; // JSON 파싱 실패해도 null 처리
        }

        if (!res.ok) {
            const status = res?.status ?? "unknown";
            const msg = data?.message ? String(data.message) : `${fallbackMsg} (HTTP ${status})`;
            const e = new Error(msg);
            e.status = status;
            e.body = data;
            throw e;
        }

        return data;
    } catch (err) {
        console.error("API fetch error:", err);

        let message = fallbackMsg;
        if (err) {
            if (typeof err === "string") message = err;
            else if (err instanceof Error) message = err.message;
            else if (err.message) message = String(err.message);
        }

        const e = new Error(message);
        e.original = err; // 원본 err 보존
        throw e;
    }
}

// ------------------------
// API 함수
// ------------------------

// 글 전체 조회
export const getPosts = async (token) => {
    const data = await handleFetch(`${API_BASE}`, { headers: makeHeaders(token) }, "게시물 조회 실패");

    if (Array.isArray(data)) return data;
    if (data?.post_list) return data.post_list;
    if (data?.data) return data.data;
    if (data && typeof data === 'object') {
        for (const k of Object.keys(data)) {
            if (Array.isArray(data[k])) return data[k];
        }
    }
    return [];
};

// 단일 글 조회
export const getPostById = async (postId, token) => {
    return handleFetch(`${API_BASE}/${postId}`, { headers: makeHeaders(token) }, "게시물 조회 실패");
};

// 내가 쓴 글
export const getMyPosts = async (token) => {
    return handleFetch(`${API_BASE}/me`, { headers: makeHeaders(token) }, "내 글 조회 실패");
};

// 글 작성
export const createPost = async (payload, token) => {
    if (!token) throw new Error("로그인 후 시도해주세요.");
    return handleFetch(`${API_BASE}`, {
        method: "POST",
        headers: makeHeaders(token),
        body: JSON.stringify(payload),
    }, "글 작성 실패");
};

// 글 수정
export const updatePost = async (postId, payload, token) => {
    return handleFetch(`${API_BASE}/${postId}`, {
        method: "PUT",
        headers: makeHeaders(token),
        body: JSON.stringify(payload),
    }, "글 수정 실패");
};

// 글 삭제
export const deletePost = async (postId, token) => {
    await handleFetch(`${API_BASE}/${postId}`, {
        method: "DELETE",
        headers: makeHeaders(token),
    }, "글 삭제 실패");
    return true;
};

// 글 검색
export const searchPosts = async (keyword, token) => {
    return handleFetch(`${API_BASE}/keyword?keyword=${encodeURIComponent(keyword)}`, {
        headers: makeHeaders(token),
    }, "게시물 검색 실패");
};

// 좋아요
export const likePost = async (postId, token) => {
    return handleFetch(`${API_BASE}/like/${postId}`, {
        method: "POST",
        headers: makeHeaders(token),
    }, "좋아요 실패");
};

// 좋아요 취소
export const unlikePost = async (postId, token) => {
    return handleFetch(`${API_BASE}/like/${postId}`, {
        method: "DELETE",
        headers: makeHeaders(token),
    }, "좋아요 취소 실패");
};

// 내가 좋아요한 글
export const getMyLikedPosts = async (token) => {
    return handleFetch(`${API_BASE}/like/my`, { headers: makeHeaders(token) }, "내 좋아요 글 조회 실패");
};

// 특정 글 좋아요 수
export const getPostLikeCount = async (postId, token) => {
    return handleFetch(`${API_BASE}/like/count/${postId}`, { headers: makeHeaders(token) }, "좋아요 수 조회 실패");
};

// 임시 글 저장
export const saveDraft = async (data, token) => {
    return handleFetch(`${API_BASE}/draft`, {
        method: "POST",
        headers: makeHeaders(token),
        body: JSON.stringify(data),
    }, "임시 글 저장 실패");
};

// 임시 글 조회
export const getDrafts = async (token) => {
    return handleFetch(`${API_BASE}/draft`, { headers: makeHeaders(token) }, "임시 글 조회 실패");
};