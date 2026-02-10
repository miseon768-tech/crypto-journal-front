import { getStoredToken } from './_client';

const API_BASE = "http://localhost:8080/api/comment";

const makeHeaders = (token, isJson = true) => {
    const t = getStoredToken(token);
    const headers = t ? { Authorization: `Bearer ${t}` } : {};
    if (isJson) headers['Content-Type'] = 'application/json';
    return headers;
};

async function safeJson(res) {
    try {
        return await res.json();
    } catch {
        return null;
    }
}

// (1) 댓글 작성
export const addComment = async (data, token) => {
    const res = await fetch(`${API_BASE}`, {
        method: 'POST',
        headers: makeHeaders(token, true),
        body: JSON.stringify(data),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.message || '댓글 작성 실패');
    return json;
};

// (2) 댓글 수정
export const updateComment = async (commentId, content, token) => {
    const res = await fetch(`${API_BASE}/${commentId}`, {
        method: 'PUT',
        headers: makeHeaders(token, true),
        body: JSON.stringify({ content }),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.message || '댓글 수정 실패');
    return json;
};

// (3) 댓글 삭제
export const deleteComment = async (commentId, token) => {
    const res = await fetch(`${API_BASE}/${commentId}`, {
        method: 'DELETE',
        headers: makeHeaders(token, false),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.message || '댓글 삭제 실패');
    return json;
};

// (4) 특정 글 댓글 목록 조회
export const getCommentsByPost = async (postId, token) => {
    const res = await fetch(`${API_BASE}/${postId}`, {
        method: 'GET',
        headers: makeHeaders(token, false),
    });
    if (!res.ok) throw new Error('댓글 목록 조회 실패');
    return res.json();
};

// (5) 사용자 댓글 목록 조회
export const getCommentsByUser = async (token) => {
    const res = await fetch(`${API_BASE}/user`, {
        method: 'GET',
        headers: makeHeaders(token, false),
    });
    if (!res.ok) throw new Error('사용자 댓글 조회 실패');
    return res.json();
};