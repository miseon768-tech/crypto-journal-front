import { getStoredToken, authHeader } from './_client';

const API_BASE = "http://localhost:8080/api/post";

// (1) 글 전체 조회
export async function getPosts(token) {
    const res = await fetch(`${API_BASE}/api/post`, {
        method: 'GET',
        headers: { Authorization: "Bearer " + token },
    });
    return res.json();
}

// (2) 단일 글 조회
export async function getPostById(postId, token) {
    const t = token || getStoredToken();
    const res = await fetch(`${API_BASE}/${postId}`, {
        method: 'GET',
        headers: makeHeaders(t, false),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// (3) 내가 쓴 글 조회
export async function getMyPosts(token) {
    const t = token || getStoredToken();
    const res = await fetch(`${API_BASE}/me`, {
        method: 'GET',
        headers: makeHeaders(t, false),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// (4) 글 작성
export async function createPost(payload, token) {
    const res = await fetch(`${serverAddr}/api/post`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
        },
        body: JSON.stringify(payload),
    });
    return res.json();
}

// (5) 글 수정
export async function updatePost(postId, data, token) {
    const t = token || getStoredToken();
    const res = await fetch(`${API_BASE}/${postId}`, {
        method: 'PUT',
        headers: makeHeaders(t, true),
        body: JSON.stringify(data),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
    return json;
}

// (6) 글 삭제
export async function deletePost(postId, token) {
    const t = token || getStoredToken();
    const res = await fetch(`${API_BASE}/${postId}`, {
        method: 'DELETE',
        headers: makeHeaders(t, false),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
    return true;
}

// (7) 키워드 검색
export async function searchPosts(keyword, token) {
    const t = token || getStoredToken();
    const res = await fetch(`${API_BASE}/keyword?keyword=${encodeURIComponent(keyword)}`, {
        method: 'GET',
        headers: makeHeaders(t, false),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// (8) 좋아요
export async function likePost(postId, token) {
    const t = token || getStoredToken();
    const res = await fetch(`${API_BASE}/like/${postId}`, {
        method: 'POST',
        headers: makeHeaders(t, false),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
    return json;
}

// (9) 좋아요 취소
export async function unlikePost(postId, token) {
    const t = token || getStoredToken();
    const res = await fetch(`${API_BASE}/like/${postId}`, {
        method: 'DELETE',
        headers: makeHeaders(t, false),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
    return json;
}

// (10) 내가 좋아요한 글 목록
export async function getMyLikedPosts(token) {
    const t = token || getStoredToken();
    const res = await fetch(`${API_BASE}/like/my`, {
        method: 'GET',
        headers: makeHeaders(t, false),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// (11) 특정 글 좋아요 수 조회
export async function getPostLikeCount(postId, token) {
    const t = token || getStoredToken();
    const res = await fetch(`${API_BASE}/like/count/${postId}`, {
        method: 'GET',
        headers: makeHeaders(t, false),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// (12) 글 임시 저장
export async function saveDraft(data, token) {
    const t = token || getStoredToken();
    const res = await fetch(`${API_BASE}/draft`, {
        method: 'POST',
        headers: makeHeaders(t, true),
        body: JSON.stringify(data),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
    return json;
}

// (13) 임시 글 불러오기
export async function getDrafts(token) {
    const t = token || getStoredToken();
    const res = await fetch(`${API_BASE}/draft`, {
        method: 'GET',
        headers: makeHeaders(t, false),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}