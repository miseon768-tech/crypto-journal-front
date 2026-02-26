import { getStoredToken } from './member';

const API_HOST = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://43.201.97.58.nip.io:8081').replace(/\/$/, '');
const API_BASE = `${API_HOST}/api/comment`;

const makeHeaders = (token) => {
    const stored = getStoredToken();
    const t = token || stored || '';
    const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    };
    if (t) headers['Authorization'] = `Bearer ${t}`;
    return headers;
};

async function handleResponse(res, fallbackMessage) {
    const text = await res.text().catch(() => null);
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { /* not json */ }

    if (!res.ok) {
        const msg = (json && json.message) ? json.message : (text || fallbackMessage || `HTTP ${res.status}`);
        const err = new Error(msg);
        err.status = res.status;
        err.body = json || text;
        throw err;
    }

    return json !== null ? json : text;
}

// 댓글 작성
export const addComment = async (data, token) => {
    if (!data || !data.postId) throw new Error('postId가 필요합니다.');
    const res = await fetch(`${API_BASE}/${encodeURIComponent(data.postId)}`, {
        method: 'POST',
        headers: makeHeaders(token),
        body: JSON.stringify({ content: data.content }),
    });
    return handleResponse(res, '댓글 작성 실패');
};

// 댓글 수정
export const updateComment = async (commentId, content, token) => {
    if (!commentId) throw new Error('commentId가 필요합니다.');
    const res = await fetch(`${API_BASE}/${commentId}`, {
        method: 'PUT',
        headers: makeHeaders(token),
        body: JSON.stringify({ content }),
    });
    return handleResponse(res, '댓글 수정 실패');
};

// 댓글 삭제
export const deleteComment = async (commentId, token) => {
    if (!commentId) throw new Error('commentId가 필요합니다.');
    const res = await fetch(`${API_BASE}/${commentId}`, {
        method: 'DELETE',
        headers: makeHeaders(token),
    });
    return handleResponse(res, '댓글 삭제 실패');
};

// 특정 글 댓글 목록 조회
export const getCommentsByPost = async (postId, token) => {
    if (!postId) throw new Error('postId가 필요합니다.');
    const res = await fetch(`${API_BASE}/${postId}`, {
        method: 'GET',
        headers: makeHeaders(token),
    });
    return handleResponse(res, '댓글 목록 조회 실패');
};

// 사용자 댓글 목록 조회
export const getCommentsByUser = async (token) => {
    const res = await fetch(`${API_BASE}/user`, {
        method: 'GET',
        headers: makeHeaders(token),
    });
    return handleResponse(res, '사용자 댓글 조회 실패');
};