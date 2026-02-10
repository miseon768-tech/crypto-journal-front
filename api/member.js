const API_HOST = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
const API_BASE = `${API_HOST.replace(/\/$/, '')}/api/member`;

// ------------------------
// 공통 응답 처리
// ------------------------
async function handleResponse(res, expectJson = false, fallbackMessage = "요청 실패") {
    if (!res.ok) {
        const text = await res.text().catch(() => null);
        let errBody = null;

        if (text) {
            try {
                errBody = JSON.parse(text);
            } catch {}
        }

        if (errBody?.message) {
            const error = new Error(errBody.message);
            error.status = res.status;
            error.body = errBody;
            throw error;
        }

        const message = text || fallbackMessage;
        const error = new Error(message);
        error.status = res.status;
        error.body = text;
        throw error;
    }

    if (expectJson) return res.json();
    return res.text().catch(() => null);
}

// ------------------------
// 유틸 함수: 토큰 처리 (안전하게)
// ------------------------
function extractTokenFromObject(obj) {
    if (!obj || typeof obj !== 'object') return null;
    if (obj.token) return String(obj.token).trim();
    if (obj.accessToken) return String(obj.accessToken).trim();
    if (obj.access_token) return String(obj.access_token).trim();
    if (obj.value) return String(obj.value).trim();

    // common wrapper keys
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

    // 문자열 fields that may contain raw token
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

function normalizeTokenStringSafe(token) {
    if (!token && token !== "") return null;
    try {
        if (typeof token === "string") {
            let t = token.trim();
            if (!t) return null;
            if (t.startsWith('"') && t.endsWith('"') && t.length > 1) {
                t = t.substring(1, t.length - 1);
            }

            // JSON 문자열이면 내부 토큰 추출 시도
            if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('"{') && t.endsWith('}"'))) {
                try {
                    const parsed = JSON.parse(t);
                    const inner = extractTokenFromObject(parsed) || normalizeTokenStringSafe(parsed);
                    if (inner) return inner;
                } catch (e) {
                    // ignore
                }
            }

            // 'Bearer ' 제거
            if (t.toLowerCase().startsWith('bearer ')) t = t.substring(7).trim();

            return t || null;
        }

        if (typeof token === "object") {
            const fromObj = extractTokenFromObject(token);
            if (fromObj) return fromObj;
            // nested persist format e.g. { state: { token: '...' } }
            try {
                // try to inspect nested keys
                for (const k of ['state', 'data', 'payload']) {
                    if (token[k] && typeof token[k] === 'object') {
                        const t = extractTokenFromObject(token[k]);
                        if (t) return t;
                    }
                }
            } catch (e) {}

            // fallback: stringify
            const s = JSON.stringify(token);
            return s && s !== "{}" ? s.trim() : null;
        }

        return String(token).trim();
    } catch (e) {
        return null;
    }
}

// 토큰 가져오기: 인자로 들어오면 정규화, 없으면 localStorage 확인
export const getStoredToken = (token) => {
    const normalized = normalizeTokenStringSafe(token);
    if (normalized) return normalized;
    if (typeof window !== "undefined") {
        // 체크할 가능성 있는 로컬스토리지 키들
        const candidates = ["token", "persist:token", "zustand:token", "persist_token", "auth:token", "persist", "persist:root", "zustand"];
        for (const key of candidates) {
            try {
                const stored = localStorage.getItem(key);
                if (!stored) continue;
                // stored 자체가 JSON 래퍼일 수 있음
                const parsed = (() => {
                    try { return JSON.parse(stored); } catch { return null; }
                })();
                if (typeof parsed === 'string') {
                    const t = normalizeTokenStringSafe(parsed);
                    if (t) return t;
                }
                if (parsed && typeof parsed === 'object') {
                    // common shapes: { token: '...' } or { state: { token: '...' } }
                    const t = extractTokenFromObject(parsed) || normalizeTokenStringSafe(parsed);
                    if (t) return t;
                }
                // fallback: stored is string token
                const t = normalizeTokenStringSafe(stored);
                if (t) return t;
            } catch (e) {
                // continue
            }
        }
        // 마지막으로 기본 'token' 키 확인
        const fallback = localStorage.getItem("token");
        return (fallback && normalizeTokenStringSafe(fallback)) || "";
    }
    return "";
};

// ------------------------
// 로그인
// ------------------------
export const login = async (email, password) => {
    const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    if (!res.ok) return handleResponse(res, false, "로그인 실패");

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("application/json")) {
        const json = await res.json();
        if (json && (json.token || json.accessToken)) {
            const raw = String(json.token || json.accessToken);
            const token = normalizeTokenStringSafe(raw);
            return { ...json, token };
        }
        return json;
    }

    const textData = await res.text().catch(() => null);
    if (textData) {
        const token = normalizeTokenStringSafe(textData);
        return { token };
    }
    throw new Error("로그인 응답이 비어있습니다");
};

// ------------------------
// 회원가입
// ------------------------
export const signUp = async (data) => {
    const res = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    return handleResponse(res, true, "회원가입 실패");
};

// ------------------------
// 이메일 코드 전송
// ------------------------
export const sendEmailCode = async (email) => {
    const res = await fetch(`${API_BASE}/email/code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });
    return handleResponse(res, false, "이메일 코드 전송 실패");
};

// ------------------------
// 내 정보 조회
// ------------------------
export const getMyInfo = async (token) => {
    const rawToken = getStoredToken(token);
    if (!rawToken) {
        return { error: { status: null, message: "토큰이 없습니다. 다시 로그인해주세요." } };
    }

    try {
        const res = await fetch(`${API_BASE}/me`, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${rawToken}`,
            },
        });

        if (!res.ok) {
            const errText = await res.text().catch(() => null);
            let errMsg = `HTTP ${res.status}`;
            let errJson = null;
            if (errText) {
                try {
                    errJson = JSON.parse(errText);
                    errMsg = errJson.message || errMsg;
                } catch {
                    errMsg = errText || errMsg;
                }
            }
            return { error: { status: res.status, message: errMsg, body: errJson || errText } };
        }

        const data = await res.json().catch(() => null);
        if (!data || typeof data !== 'object') {
            return { error: { status: null, message: '내 정보 응답이 비어있습니다. 다시 로그인해주세요.', body: data } };
        }

        return { data };
    } catch (err) {
        return { error: { status: null, message: err.message || '내 정보 조회 중 오류', body: null } };
    }
};

// ------------------------
// 정보 수정
// ------------------------
export const updateMember = async (token, data) => {
    const authToken = getStoredToken(token);
    const res = await fetch(`${API_BASE}/me`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(data),
    });
    return handleResponse(res, true, "정보 수정 실패");
};

// ------------------------
// 비밀번호 변경
// ------------------------
export const changePassword = async (token, data) => {
    const authToken = getStoredToken(token);
    const res = await fetch(`${API_BASE}/me/password`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(data),
    });
    return handleResponse(res, true, "비밀번호 변경 실패");
};

// ------------------------
// 회원 탈퇴
// ------------------------
export const deleteMember = async (token, password) => {
    const authToken = getStoredToken(token);
    const res = await fetch(`${API_BASE}/me`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ password }),
    });
    return handleResponse(res, true, "회원 탈퇴 실패");
};

// ------------------------
// 이메일 코드 검증
// ------------------------
export const verifyEmailCode = async (email, code) => {
    const res = await fetch(`${API_BASE}/email/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
    });
    return handleResponse(res, false, "인증 코드 확인 실패");
};