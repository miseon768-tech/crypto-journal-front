import { getStoredToken } from './member';

const API_HOST = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080').replace(/\/$/, '');
const API_BASE = `${API_HOST}/api/comment`;

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
    // 토큰이 인자로 없을 수 있으므로 안전하게 추출
    let t = getStoredToken(token);
    if (!t && typeof window !== 'undefined') {
        try {
            const candidate = localStorage.getItem('token') || localStorage.getItem('persist:token') || localStorage.getItem('zustand:token');
            t = getStoredToken(candidate) || t;
        } catch (e) {}
    }

    // 기본 검증
    if (!data || !data.postId) throw new Error('postId가 필요합니다.');
    if (!data.content || !String(data.content).trim()) throw new Error('댓글 내용을 입력하세요.');

    // (선택) 대상 포스트 존재 확인 — 실패 시 명확한 에러 반환
    try {
        const postRes = await fetch(`${API_HOST}/api/post/${encodeURIComponent(data.postId)}`, {
            method: 'GET',
            headers: t ? { Authorization: `Bearer ${t}` } : {},
        });
        if (!postRes.ok) {
            const txt = await postRes.text().catch(() => null);
            console.warn('[api/comment] 대상 포스트 조회 실패', { status: postRes.status, body: txt });
            if (postRes.status === 404) {
                const e = new Error('대상 글을 찾을 수 없습니다.');
                e.status = 404;
                throw e;
            }
            // 기타 오류는 계속 진행해 원본 에러를 보여줌
        }
    } catch (e) {
        // 네트워크/권한 등으로 인해 포스트 확인 실패하면 사용자에게 알리고 중단
        console.error('[api/comment] post existence check failed', e);
        throw e;
    }

    // 디버그 로그
    try { if (typeof console !== 'undefined') console.debug('[api/comment] addComment token len:', t ? t.length : null, 'snippet:', t ? t.substring(0,20)+'...' : null, 'payload:', data); } catch (e) {}

    const headers = (t ? { Authorization: `Bearer ${t}` } : {});
    headers['Content-Type'] = 'application/json';

    const res = await fetch(`${API_BASE}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
        credentials: 'include',
    });

    const text = await res.text().catch(() => null);
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }

    if (!res.ok) {
        // 상세한 에러 로그
        console.error('[api/comment] addComment non-ok response ', { status: res.status, headers: Object.fromEntries(res.headers || []), body: json || text });
        const msg = (json && json.message) ? json.message : (text || `HTTP ${res.status}`);
        const err = new Error(msg);
        err.status = res.status;
        err.body = json || text;
        throw err;
    }

    // 성공 시 JSON 반환
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
    const t = getStoredToken(token);
    const headers = t ? { Authorization: `Bearer ${t}` } : {};
    const res = await fetch(`${API_BASE}/${postId}`, {
        method: 'GET',
        headers,
    });
    const text = await res.text().catch(() => null);
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
    if (!res.ok) {
        const err = new Error(json?.message || text || `HTTP ${res.status}`);
        err.status = res.status;
        err.body = json || text;
        throw err;
    }

    // 정규화: 여러 래퍼 처리
    if (Array.isArray(json)) return json;
    if (json && Array.isArray(json.comment_list)) return json.comment_list;
    if (json && Array.isArray(json.data)) return json.data;
    if (json && Array.isArray(json.comments)) return json.comments;
    // fallback: if object has any array property, return first array
    if (json && typeof json === 'object') {
        for (const k of Object.keys(json)) if (Array.isArray(json[k])) return json[k];
    }

    return [];
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