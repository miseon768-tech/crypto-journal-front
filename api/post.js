// api/post.js
const API_HOST = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://3.36.109.46.nip.io:8080").replace(/\/$/, '');
const API_BASE = `${API_HOST}/api/post`;
import { getStoredToken } from './member';

// ------------------------
// 헤더 생성
// ------------------------
function makeHeaders(token) {
    const t = token || getStoredToken();
    const headers = { 'Content-Type': 'application/json' };
    if (t) headers['Authorization'] = `Bearer ${t}`;
    return headers;
}

// ------------------------
// 공통 fetch 처리
// ------------------------
async function handleFetch(url, options = {}, fallbackMsg = "API 요청 실패") {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw { message: data?.message || fallbackMsg, status: res.status, body: data };
    return data;
}

// ------------------------
// API 함수
// ------------------------

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

// 글 작성 (및 수정: 수정 시 postId 쿼리 파라미터를 사용합니다)
// createPost(payload, token, postId?) 형태로 사용하세요.
export const createPost = (payload, token, postId) => {
    if (!token) throw { message: "로그인 후 시도해주세요." };
    const url = postId ? `${API_BASE}?postId=${encodeURIComponent(postId)}` : API_BASE;
    return handleFetch(url, { method: "POST", headers: makeHeaders(token), body: JSON.stringify(payload) }, "글 작성 실패");
};

// 기존 updatePost 호출을 사용하는 코드와의 호환을 위해 포워딩 함수 제공
export const updatePost = (postId, payload, token) =>
    // backend는 PUT 대신 POST + ?postId= 를 기대하므로 createPost로 위임
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

// 임시 글 저장
// 임시 글 저장: backend의 savePost를 사용하도록 변경 (draft 플래그 포함)
export const saveDraft = (data, token, postId) =>
    // data: { title, content, ... } -> 강제 draft=true
    createPost({ ...data, draft: true }, token, postId);

// 임시 글 조회
export const getDrafts = (token) =>
    handleFetch(`${API_BASE}/draft`, { headers: makeHeaders(token) }, "임시 글 조회 실패");