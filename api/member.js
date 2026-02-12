const API_HOST = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
const API_BASE = `${API_HOST.replace(/\/$/, '')}/api/member`;

// ------------------------
// 토큰 처리 (강화됨)
// ------------------------
function _findTokenInObject(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const keys = ['token', 'accessToken', 'access_token', 'value'];
    for (const k of keys) {
        if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k]) return String(obj[k]);
    }
    // nested common wrappers
    for (const k of ['state', 'data', 'payload']) {
        if (obj[k] && typeof obj[k] === 'object') {
            const t = _findTokenInObject(obj[k]);
            if (t) return t;
        }
    }
    // find any jwt-like string among values
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]*$/;
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

    // already a string
    if (typeof raw === 'string') {
        const s = raw.trim();
        if (!s) return null;
        // Bearer prefix
        if (/^Bearer\s+/i.test(s)) return s.replace(/^Bearer\s+/i, '');
        // try parse JSON
        if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('"{') && s.endsWith('}"'))) {
            try {
                const parsed = JSON.parse(s);
                const t = _findTokenInObject(parsed);
                if (t) return t;
            } catch (e) {
                // ignore
            }
        }
        // if looks like jwt
        const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]*$/;
        if (jwtRegex.test(s)) return s;
        // fallback: return raw string
        return s;
    }

    // non-string (object) -> extract
    try {
        const t = _findTokenInObject(raw);
        if (t) return t;
    } catch (e) {
        // ignore
    }

    try { return String(raw); } catch (e) { return null; }
};

export const setToken = (token) => {
    if (typeof window !== 'undefined') {
        if (!token) {
            localStorage.removeItem('token');
            return;
        }
        // store as plain token string (no Bearer prefix)
        const t = getStoredToken(token) || String(token);
        localStorage.setItem('token', t);
    }
};

export const removeToken = () => {
    if (typeof window !== "undefined") localStorage.removeItem("token");
};

// ------------------------
// 로그인
// ------------------------
export const login = async (email, password) => {
    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => null);
            const msg = text || "로그인 실패";
            throw new Error(msg);
        }

        const data = await res.json();
        const token = data.token || data.accessToken || data.access_token || null;
        if (token) setToken(token);

        return { ...data, token };
    } catch (err) {
        console.error("Login error:", err);
        throw new Error(err.message || "로그인 중 오류 발생");
    }
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

    if (!res.ok) {
        const text = await res.text().catch(() => null);
        throw new Error(text || "회원가입 실패");
    }
    return res.json();
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
    if (!res.ok) {
        const text = await res.text().catch(() => null);
        throw new Error(text || "이메일 코드 전송 실패");
    }
    return res.text();
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
    if (!res.ok) {
        const text = await res.text().catch(() => null);
        throw new Error(text || "이메일 인증 실패");
    }
    return res.text();
};

// ------------------------
// 내 정보 조회
// ------------------------
export const getMyInfo = async (token) => {
    const authToken = token || getStoredToken();
    if (!authToken) throw new Error("토큰이 없습니다.");

    const res = await fetch(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
    });

    if (!res.ok) {
        const text = await res.text().catch(() => null);
        throw new Error(text || "내 정보 조회 실패");
    }
    return res.json();
};

// ------------------------
// 정보 수정
// ------------------------
export const updateMember = async (token, data) => {
    const authToken = token || getStoredToken();
    const res = await fetch(`${API_BASE}/me`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(data),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => null);
        throw new Error(text || "정보 수정 실패");
    }
    return res.json();
};

// ------------------------
// 비밀번호 변경
// ------------------------
export const changePassword = async (token, data) => {
    const authToken = token || getStoredToken();
    const res = await fetch(`${API_BASE}/me/password`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(data),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => null);
        throw new Error(text || "비밀번호 변경 실패");
    }
    return res.json();
};

// ------------------------
// 회원 탈퇴
// ------------------------
export const deleteMember = async (token, password) => {
    const authToken = token || getStoredToken();
    const res = await fetch(`${API_BASE}/me`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ password }),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => null);
        throw new Error(text || "회원 탈퇴 실패");
    }
    return res.json();
};