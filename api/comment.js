import { getStoredToken } from './member';

const API_HOST = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080').replace(/\/$/, '');
const API_BASE = `${API_HOST}/api/comment`;

const makeHeaders = (token) => ({
    Authorization: `Bearer ${getStoredToken(token) || ''}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
});

// 댓글 작성
export const addComment = async (data, token) => {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(data.postId)}`, {
        method: 'POST',
        headers: makeHeaders(token),
        body: data.content,
    });
    return res.json();
};

// 댓글 수정
export const updateComment = async (commentId, content, token) => {
    const res = await fetch(`${API_BASE}/${commentId}`, {
        method: 'PUT',
        headers: makeHeaders(token),
        body: JSON.stringify({ content }),
    });
    return res.json();
};

// 댓글 삭제
export const deleteComment = async (commentId, token) => {
    const res = await fetch(`${API_BASE}/${commentId}`, {
        method: 'DELETE',
        headers: makeHeaders(token),
    });
    return res.json();
};

// 특정 글 댓글 목록 조회
export const getCommentsByPost = async (postId, token) => {
    const res = await fetch(`${API_BASE}/${postId}`, {
        method: 'GET',
        headers: makeHeaders(token),
    });
    return res.json();
};

// 사용자 댓글 목록 조회
export const getCommentsByUser = async (token) => {
    const res = await fetch(`${API_BASE}/user`, {
        method: 'GET',
        headers: makeHeaders(token),
    });
    return res.json();
};