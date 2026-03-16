import { getStoredToken } from './member';

const API_HOST = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://3.36.109.46.nip.io:8080').replace(/\/$/, '');
const API_BASE = `${API_HOST}/api/comment`;
const API_LIKE_BASE = `${API_HOST}/api/comment/like`;

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
    try { json = text ? JSON.parse(text) : null; } catch (e) { /* ignore non-json */ }

    if (res.ok) {
        return json !== null ? json : text;
    }

    const message = (json && json.message) ? json.message : (text || fallbackMessage || `Request failed`);
    // log non-ok responses for easier debugging (don't expose tokens)
    try {
        console.debug('[api/comment] non-ok response', { status: res.status, message, body: json !== null ? json : text });
    } catch (e) { /* ignore */ }

    if (res.status >= 500) {
        try { console.error('[api/comment] server error', { status: res.status, message, body: json !== null ? json : text }); } catch (e) { /* ignore */ }
    }

    return {
        __error: true,
        status: res.status,
        body: json !== null ? json : text,
        message,
        isServerError: res.status >= 500,
    };
}

// 댓글 작성
export const addComment = async (data, token) => {
    if (!data || !data.postId) throw new Error('postId가 필요합니다.');
    try {
        const res = await fetch(`${API_BASE}/${encodeURIComponent(data.postId)}`, {
            method: 'POST',
            headers: makeHeaders(token),
            body: JSON.stringify({ content: data.content }),
        });
        return await handleResponse(res, '댓글 작성 실패');
    } catch (err) {
        console.error('[api/comment] addComment error', { postId: data.postId, err });
        return { __error: true, status: err?.status || null, body: err?.body || null, message: err?.message || '댓글 작성 실패' };
    }
};

// 댓글 수정
export const updateComment = async (commentId, content, token) => {
    if (!commentId) throw new Error('commentId가 필요합니다.');
    try {
        const res = await fetch(`${API_BASE}/${commentId}`, {
            method: 'PUT',
            headers: makeHeaders(token),
            body: JSON.stringify({ content }),
        });
        return await handleResponse(res, '댓글 수정 실패');
    } catch (err) {
        console.error('[api/comment] updateComment error', { commentId, err });
        return { __error: true, status: err?.status || null, body: err?.body || null, message: err?.message || '댓글 수정 실패' };
    }
};

// 댓글 삭제
export const deleteComment = async (commentId, token) => {
    if (!commentId) throw new Error('commentId가 필요합니다.');
    try {
        const res = await fetch(`${API_BASE}/${commentId}`, {
            method: 'DELETE',
            headers: makeHeaders(token),
        });
        return await handleResponse(res, '댓글 삭제 실패');
    } catch (err) {
        console.error('[api/comment] deleteComment error', { commentId, err });
        return { __error: true, status: err?.status || null, body: err?.body || null, message: err?.message || '댓글 삭제 실패' };
    }
};

// 특정 글 댓글 목록 조회
export const getCommentsByPost = async (postId, token) => {
    if (!postId) throw new Error('postId가 필요합니다.');
    try {
        const res = await fetch(`${API_BASE}/${postId}`, {
            method: 'GET',
            headers: makeHeaders(token),
        });
        return await handleResponse(res, '댓글 목록 조회 실패');
    } catch (err) {
        console.error('[api/comment] getCommentsByPost error', { postId, err });
        return { __error: true, status: err?.status || null, body: err?.body || null, message: err?.message || '댓글 목록 조회 실패' };
    }
};

// 사용자 댓글 목록 조회
export const getCommentsByUser = async (token) => {
    try {
        const res = await fetch(`${API_BASE}/user`, {
            method: 'GET',
            headers: makeHeaders(token),
        });
        return await handleResponse(res, '사용자 댓글 조회 실패');
    } catch (err) {
        console.error('[api/comment] getCommentsByUser error', { err });
        return { __error: true, status: err?.status || null, body: err?.body || null, message: err?.message || '사용자 댓글 조회 실패' };
    }
};

// 댓글 좋아요
export const likeComment = async (commentId, token) => {
    if (!commentId) throw new Error('commentId가 필요합니다.');
    // debug aid: log minimal info (avoid printing token fully)
    try {
        console.debug('[api/comment] likeComment', { commentId, hasToken: Boolean(token) });
    } catch (e) { /* ignore */ }
    try {
        const res = await fetch(`${API_LIKE_BASE}/${commentId}`, {
            method: 'POST',
            headers: makeHeaders(token),
        });
        return await handleResponse(res, '댓글 좋아요 실패');
    } catch (err) {
        console.error('[api/comment] likeComment error', { commentId, err });
        return { __error: true, status: err?.status || null, body: err?.body || null, message: err?.message || '댓글 좋아요 실패' };
    }
};

// 댓글 좋아요 취소
export const unlikeComment = async (commentId, token) => {
    if (!commentId) throw new Error('commentId가 필요합니다.');
    try {
        console.debug('[api/comment] unlikeComment', { commentId, hasToken: Boolean(token) });
    } catch (e) { /* ignore */ }
    try {
        const res = await fetch(`${API_LIKE_BASE}/${commentId}`, {
            method: 'DELETE',
            headers: makeHeaders(token),
        });
        return await handleResponse(res, '댓글 좋아요 취소 실패');
    } catch (err) {
        console.error('[api/comment] unlikeComment error', { commentId, err });
        return { __error: true, status: err?.status || null, body: err?.body || null, message: err?.message || '댓글 좋아요 취소 실패' };
    }
};
