// /src/lib/apiMember.js
// 회원/토큰 관련 API
// 로그인, 회원가입, 이메일 인증, 내 정보 조회/수정, 비밀번호 변경, 회원 탈퇴

const API_HOST = process.env.NEXT_PUBLIC_BACKEND_URL || "http://43.201.97.58.nip.io:8081";
const API_BASE = `${API_HOST.replace(/\/$/, '')}/api/member`;

// ------------------------
// 토큰 처리
// ------------------------
function _findTokenInObject(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const keys = ['token', 'accessToken', 'access_token', 'value'];
    for (const k of keys) {
        if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k]) return String(obj[k]);
    }
    for (const k of ['state', 'data', 'payload']) {
        if (obj[k] && typeof obj[k] === 'object') {
            const t = _findTokenInObject(obj[k]);
            if (t) return t;
        }
    }
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+\/=]*$/;
    for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (typeof v === 'string' && jwtRegex.test(v.trim())) return v.trim();
    }
    return null;
}

export const getStoredToken = (incoming) => {
    let raw = incoming;
    if (!raw && typeof window !== 'undefined') raw = localStorage.getItem('token');
    if (!raw) return null;

    if (typeof raw === 'string') {
        const s = raw.trim();
        if (!s) return null;
        if (/^Bearer\s+/i.test(s)) return s.replace(/^Bearer\s+/i, '');
        if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('"{') && s.endsWith('}"'))) {
            try {
                const parsed = JSON.parse(s);
                const t = _findTokenInObject(parsed);
                if (t) return t;
            } catch (e) {}
        }
        const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+\/=]*$/;
        if (jwtRegex.test(s)) return s;
        return s;
    }

    try {
        const t = _findTokenInObject(raw);
        if (t) return t;
    } catch (e) {}

    try { return String(raw); } catch (e) { return null; }
};

export const setToken = (token) => {
    if (typeof window !== 'undefined') {
        if (!token) {
            localStorage.removeItem('token');
        } else {
            const s = getStoredToken(token) || String(token);
            if (s) localStorage.setItem('token', s);
        }
    }
};

export const removeToken = () => {
    if (typeof window !== "undefined") localStorage.removeItem("token");
};

// ------------------------
// 인증 실패시 자동 로그아웃/처리(공통)
// ------------------------
const handleAuthFailure = (msg = "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.") => {
    removeToken();
    alert(msg);
    if (typeof window !== 'undefined') {
        window.location.href = "/login";
    }
};

// ------------------------
// 공통 fetch (토큰 포함)
// ------------------------
const authFetch = async (url, options = {}) => {
    const token = options.token || getStoredToken();
    if (!token) {
        handleAuthFailure("토큰이 없습니다. 다시 로그인 해주세요.");
        const e = new Error('토큰이 없습니다. 로그인 후 토큰을 저장하세요.');
        e.status = 401;
        throw e;
    }
    const tokenStr = typeof token === 'string' ? token : String(token);

    const res = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenStr}`,
            ...(options.headers || {})
        },
    });

    if (!res.ok) {
        if (res.status === 401) {
            handleAuthFailure();
        }
        const text = await res.text().catch(() => null);
        const err = new Error(text || `HTTP ${res.status}`);
        err.status = res.status;
        err.body = text;
        console.error('[api/member] authFetch non-ok response', { url, status: res.status, body: text });
        throw err;
    }

    return res;
};

// ------------------------
// 로그인 / 회원가입
// ------------------------
export const login = async (email, password) => {
    const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => null);
        throw new Error(text || "로그인 실패");
    }

    const data = await res.json();
    const token = data.token || data.accessToken || data.access_token || null;
    if (token) setToken(token);

    return { ...data, token };
};

export const signUp = async (data) => {
    const res = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => null);
        throw new Error(text || "회원가입 실패");
    }
    return res.json();
};

// ------------------------
// 이메일 인증
// ------------------------
export const sendEmailCode = async (email) => {
    const res = await fetch(`${API_BASE}/email/code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => null);
        throw new Error(text || "이메일 코드 전송 실패");
    }
    return res.text();
};

export const verifyEmailCode = async (email, code) => {
    const res = await fetch(`${API_BASE}/email/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => null);
        throw new Error(text || "이메일 인증 실패");
    }
    return res.text();
};

// ------------------------
// 내 정보 조회 / 수정 / 비밀번호 변경 / 탈퇴
// ------------------------
export const getMyInfo = async (token) => {
    const res = await authFetch(`${API_BASE}/me`, { token });
    return res.json();
};

export const updateMember = async (token, data) => {
    const res = await authFetch(`${API_BASE}/me`, {
        method: "PUT",
        token,
        body: JSON.stringify(data),
    });
    return res.json();
};

export const changePassword = async (token, data) => {
    const res = await authFetch(`${API_BASE}/me/password`, {
        method: "PUT",
        token,
        body: JSON.stringify(data),
    });
    return res.json();
};

export const deleteMember = async (token, password) => {
    const res = await authFetch(`${API_BASE}/me`, {
        method: "DELETE",
        token,
        body: JSON.stringify({ password }),
    });
    return res.json();
};