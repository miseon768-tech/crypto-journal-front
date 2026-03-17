const API_HOST = process.env.NEXT_PUBLIC_BACKEND_URL ? process.env.NEXT_PUBLIC_BACKEND_URL.replace(/\/$/, '') : '';
const API_BASE = API_HOST ? `${API_HOST}/api/post` : `/api/post`;
import { getStoredToken } from './member';

function makeHeaders(token, body) {
    const t = token || getStoredToken();
    const headers = {};
    // Only set Content-Type if we have a request body (avoid unnecessary preflight on GET)
    if (body !== undefined && body !== null) headers['Content-Type'] = 'application/json';
    if (t) headers['Authorization'] = `Bearer ${t}`;
    return headers;
}

async function handleFetch(url, options = {}, fallbackMsg = "API 요청 실패") {
    // Normalize options and headers
    const opts = { ...options };
    opts.headers = opts.headers || {};

    // If options.body is present and is an object, stringify it and ensure Content-Type header
    if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
        try { opts.body = JSON.stringify(opts.body); } catch (e) { /* leave as-is */ }
        if (!opts.headers['Content-Type'] && !opts.headers['content-type']) {
            opts.headers['Content-Type'] = 'application/json';
        }
    }

    // Allow caller to override timeout via options.timeout (ms)
    const timeoutMs = typeof opts.timeout === 'number' && opts.timeout > 0 ? opts.timeout : 10000;
    let controller;
    let timer;
    if (typeof AbortController !== 'undefined') {
        controller = new AbortController();
        opts.signal = controller.signal;
        timer = setTimeout(() => controller.abort(), timeoutMs);
    }

    const parseResponse = async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw { message: data?.message || fallbackMsg, status: res.status, body: data };
        return data;
    };

    try {
        const res = await fetch(url, opts);
        if (timer) clearTimeout(timer);
        return await parseResponse(res);
    } catch (err) {
        if (timer) clearTimeout(timer);
        // Normalize network/abort errors into a structured object so callers can inspect
        if (err && err.name === 'AbortError') {
            throw { message: '요청 시간이 초과되었습니다. 네트워크 상태를 확인하세요.', status: null, original: err };
        }

        // If the request was to an absolute API_HOST and failed (network/CORS), try a relative fallback once
        try {
            const isAbsolute = typeof url === 'string' && /^(https?:)?\/\//.test(url);
            if (API_HOST && isAbsolute && url.indexOf(API_HOST) !== -1) {
                const relative = url.replace(API_HOST, '');
                // Only try if relative looks like an API path
                if (relative && relative.startsWith('/api')) {
                    try {
                        const res2 = await fetch(relative, opts);
                        return await parseResponse(res2);
                    } catch (err2) {
                        // fallthrough to throw original error below
                        console.warn('[api/post] fallback to relative path also failed', err2);
                    }
                }
            }
        } catch (fallbackErr) {
            console.warn('[api/post] fallback check error', fallbackErr);
        }

        // If fetch itself threw a TypeError (like CORS or network failure), provide a clearer message
        const msg = (err && err.message) ? err.message : String(err || '네트워크 오류');
        throw { message: msg.includes('Failed to fetch') ? '네트워크에 연결할 수 없습니다. 백엔드가 실행 중인지, CORS 설정과 NEXT_PUBLIC_BACKEND_URL이 올바른지 확인하세요.' : msg, status: null, original: err };
    }
}

// 글 전체 조회
export const getPosts = (token) => handleFetch(API_BASE, { headers: makeHeaders(token) }, "게시물 조회 실패");

// 단일 글 조회
export const getPostById = (postId, token) =>
    handleFetch(`${API_BASE}/${postId}`, { headers: makeHeaders(token) }, "게시물 조회 실패");

// 조회수 증가
export const increaseViewCount = (postId, token) =>
    handleFetch(`${API_BASE}/${postId}/view`, { method: 'POST', headers: makeHeaders(token) }, '조회수 증가 실패');

// 내가 쓴 글
export const getMyPosts = (token) =>
    handleFetch(`${API_BASE}/me`, { headers: makeHeaders(token) }, "내 글 조회 실패");

// 글 작성 및 수정 (postId가 있으면 수정, 없으면 새 글 작성)
export const createPost = (payload, token, postId) => {
    if (!token) throw { message: "로그인 후 시도해주세요." };
    const url = postId ? `${API_BASE}?postId=${encodeURIComponent(postId)}` : API_BASE;
    return handleFetch(url, { method: "POST", headers: makeHeaders(token, payload), body: payload }, "글 작성 실패");
};

// 기존 updatePost 호출을 사용하는 코드와의 호환을 위해 포워딩 함수 제공
export const updatePost = (postId, payload, token) =>
    createPost(payload, token, postId);

// 글 삭제
export const deletePost = (postId, token) =>
    handleFetch(`${API_BASE}/${postId}`, { method: "DELETE", headers: makeHeaders(token) }, "글 삭제 실패");

// 글 검색
export const searchPosts = (keyword, token) =>
    handleFetch(`${API_BASE}/keyword?keyword=${encodeURIComponent(keyword)}`, { headers: makeHeaders(token) }, "게시물 검색 실패");

// 좋아요
export const likePost = (postId, token) =>
    handleFetch(`${API_BASE}/like/${postId}`, { method: "POST", headers: makeHeaders(token) }, "좋아요 실패");

// 좋아요 취소
export const unlikePost = (postId, token) =>
    handleFetch(`${API_BASE}/like/${postId}`, { method: "DELETE", headers: makeHeaders(token) }, "좋아요 취소 실패");

// 내가 좋아요한 글
export const getMyLikedPosts = (token) =>
    handleFetch(`${API_BASE}/like/my`, { headers: makeHeaders(token) }, "내 좋아요 글 조회 실패");

// 특정 글 좋아요 수
export const getPostLikeCount = (postId, token) =>
    handleFetch(`${API_BASE}/like/count/${postId}`, { headers: makeHeaders(token) }, "좋아요 수 조회 실패");

// 최신 글 조회
export const getPostsByLatest = async (token) => {
    const res = await handleFetch(`${API_BASE}/latest`, { headers: makeHeaders(token) }, "최신 글 조회 실패");
    return res?.postList ?? [];
};

// 좋아요 많은 글 조회
export const getPostsByLikes = async (token) => {
    const res = await handleFetch(`${API_BASE}/likes`, { headers: makeHeaders(token) }, "좋아요 많은 글 조회 실패");
    return res?.postList ?? [];
};

// 임시 글 저장
export const saveDraft = (data, token, postId) =>
    createPost({ ...data, draft: true }, token, postId);

// 임시 글 조회
export const getDrafts = (token) =>
    handleFetch(`${API_BASE}/draft`, { headers: makeHeaders(token) }, "임시 글 조회 실패");