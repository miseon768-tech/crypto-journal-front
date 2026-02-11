const API_HOST = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
const API_BASE = `${API_HOST.replace(/\/$/, '')}/api/member`;

// ------------------------
// 토큰 처리
// ------------------------
export const getStoredToken = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token") || null;
};

export const setToken = (token) => {
    if (typeof window !== "undefined") localStorage.setItem("token", token);
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

        if (!res.ok) throw new Error("로그인 실패");

        const data = await res.json();
        const token = data.token || data.accessToken || null;
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

    if (!res.ok) throw new Error("회원가입 실패");
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
    if (!res.ok) throw new Error("이메일 코드 전송 실패");
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
    if (!res.ok) throw new Error("이메일 인증 실패");
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

    if (!res.ok) throw new Error("내 정보 조회 실패");
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

    if (!res.ok) throw new Error("정보 수정 실패");
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

    if (!res.ok) throw new Error("비밀번호 변경 실패");
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

    if (!res.ok) throw new Error("회원 탈퇴 실패");
    return res.json();
};