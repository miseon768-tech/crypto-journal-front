// api/post.js
const serverAddr = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080").replace(/\/$/, '');
const API_BASE = `${serverAddr}/api/post`;
import { getStoredToken } from './member';

// 안전하게 JSON 파싱
async function safeJson(res) {
    try {
        return await res.json();
    } catch {
        return null;
    }
}

// 토큰 정리
function extractTokenFromObject(obj) {
    if (!obj || typeof obj !== 'object') return null;

    // 흔히 쓰이는 필드 우선 추출
    if (obj.token) return String(obj.token).trim();
    if (obj.accessToken) return String(obj.accessToken).trim();
    if (obj.access_token) return String(obj.access_token).trim();
    if (obj.value) return String(obj.value).trim();

    // 래퍼 필드 재귀 검사
    if (obj.state && typeof obj.state === 'object') {
        const t = extractTokenFromObject(obj.state);
        if (t) return t;
    }
    if (obj.data && typeof obj.data === 'object') {
        const t = extractTokenFromObject(obj.data);
        if (t) return t;
    }
    if (obj.payload && typeof obj.payload === 'object') {
        const t = extractTokenFromObject(obj.payload);
        if (t) return t;
    }

    // 문자열 필드 중 JWT 포맷(헤더.페이로드.서명)을 만족하면 반환
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]*$/;
    for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (typeof v === 'string') {
            const s = v.trim().replace(/^"|"$/g, '');
            if (jwtRegex.test(s)) return s;
        }
    }

    return null;
}

function getTokenString(token) {
    if (!token) return null;

    // 문자열인 경우: 따옴표/공백/Bearer 제거, JSON 문자열이면 파싱 후 추출
    if (typeof token === 'string') {
        let t = token.trim();
        if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
            t = t.substring(1, t.length - 1).trim();
        }
        if (t.toLowerCase().startsWith('bearer ')) t = t.substring(7).trim();

        if (t.startsWith('{')) {
            try {
                const parsed = JSON.parse(t);
                const extracted = extractTokenFromObject(parsed);
                if (extracted) return extracted;
            } catch (e) {
                // parsing 실패하면 문자열 자체를 사용
            }
        }
        return t || null;
    }

    // 객체인 경우: 재귀적으로 토큰을 추출
    if (typeof token === 'object') {
        const extracted = extractTokenFromObject(token);
        if (extracted) return extracted;
        try { return String(token).trim(); } catch { return null; }
    }

    try { return String(token).trim(); } catch { return null; }
}

// 공통 헤더
function makeHeaders(token, json = true) {
    const headers = {};
    if (json) headers["Content-Type"] = "application/json";

    // 우선적으로 member 모듈의 정규화 로직 사용(일관성 확보)
    const stored = getStoredToken(token);
    const tokenStr = stored || getTokenString(token);

    // 디버그 로그: 실제로 어떤 토큰 문자열이 헤더에 붙는지 확인
    try {
        if (typeof console !== 'undefined' && console.debug) {
            console.debug('[api/post] makeHeaders tokenStr length:', tokenStr ? tokenStr.length : null, 'snippet:', tokenStr ? String(tokenStr).substring(0, 20) + '...' : null);
        }
    } catch (e) {}

    if (tokenStr) headers["Authorization"] = `Bearer ${tokenStr}`;
    return headers;
}

// ---------------- API 함수 ----------------

// 글 전체 조회
export async function getPosts(token) {
    const res = await fetch(`${API_BASE}`, {
        method: "GET",
        headers: makeHeaders(token, false),
        credentials: "include",
    });
    const text = await res.text().catch(() => null);
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }

    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
            if (json && json.message) msg = json.message;
        } catch (e) {}
        const e = new Error(msg);
        e.status = res.status;
        e.body = json || text;
        throw e;
    }

    // 정규화: 여러 응답 래퍼를 처리
    if (Array.isArray(json)) return json;
    if (json && Array.isArray(json.post_list)) return json.post_list;
    if (json && Array.isArray(json.data)) return json.data;
    // 만약 서버가 { posts: [...] } 같은 다른 키를 쓰면 여기에 추가 가능
    if (json && typeof json === 'object') {
        // 시도: 첫번째 배열 프로퍼티 반환
        for (const k of Object.keys(json)) {
            if (Array.isArray(json[k])) return json[k];
        }
    }

    return []; // 안전하게 빈 배열 반환
}

// 단일 글 조회
export async function getPostById(postId, token) {
    const res = await fetch(`${API_BASE}/${postId}`, {
        method: "GET",
        headers: makeHeaders(token, false),
        credentials: "include",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// 내가 쓴 글 조회
export async function getMyPosts(token) {
    const res = await fetch(`${API_BASE}/me`, {
        method: "GET",
        headers: makeHeaders(token, false),
        credentials: "include",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// 글 작성
export async function createPost(payload, token) {
    if (!token) throw new Error("로그인 후 시도해주세요.");

    const res = await fetch(`${API_BASE}`, {
        method: "POST",
        headers: makeHeaders(token, true),
        body: JSON.stringify(payload),
        credentials: "include",
    });

    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
    return json;
}

// 글 수정
export async function updatePost(postId, data, token) {
    const res = await fetch(`${API_BASE}/${postId}`, {
        method: "PUT",
        headers: makeHeaders(token, true),
        body: JSON.stringify(data),
        credentials: "include",
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
    return json;
}

// 글 삭제
export async function deletePost(postId, token) {
    const res = await fetch(`${API_BASE}/${postId}`, {
        method: "DELETE",
        headers: makeHeaders(token, false),
        credentials: "include",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
}

// 키워드 검색
export async function searchPosts(keyword, token) {
    const res = await fetch(`${API_BASE}/keyword?keyword=${encodeURIComponent(keyword)}`, {
        method: "GET",
        headers: makeHeaders(token, false),
        credentials: "include",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// 좋아요
export async function likePost(postId, token) {
    const res = await fetch(`${API_BASE}/like/${postId}`, {
        method: "POST",
        headers: makeHeaders(token, false),
        credentials: "include",
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
    return json;
}

// 좋아요 취소
export async function unlikePost(postId, token) {
    const res = await fetch(`${API_BASE}/like/${postId}`, {
        method: "DELETE",
        headers: makeHeaders(token, false),
        credentials: "include",
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
    return json;
}

// 내가 좋아요한 글 조회
export async function getMyLikedPosts(token) {
    const res = await fetch(`${API_BASE}/like/my`, {
        method: "GET",
        headers: makeHeaders(token, false),
        credentials: "include",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// 특정 글 좋아요 수 조회
export async function getPostLikeCount(postId, token) {
    const res = await fetch(`${API_BASE}/like/count/${postId}`, {
        method: "GET",
        headers: makeHeaders(token, false),
        credentials: "include",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// 글 임시 저장
export async function saveDraft(data, token) {
    const res = await fetch(`${API_BASE}/draft`, {
        method: "POST",
        headers: makeHeaders(token, true),
        body: JSON.stringify(data),
        credentials: "include",
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
    return json;
}

// 임시 글 불러오기
export async function getDrafts(token) {
    const res = await fetch(`${API_BASE}/draft`, {
        method: "GET",
        headers: makeHeaders(token, false),
        credentials: "include",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}