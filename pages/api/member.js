const API_BASE = "http://localhost:8080/api/member";

// 공통 응답 처리
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

// 로그인
export const login = async (email, password) => {
    const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    if (!res.ok) return handleResponse(res, false, "로그인 실패");

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("application/json")) return res.json();
    const textData = await res.text().catch(() => null);
    if (textData) return { token: textData };
    throw new Error("로그인 응답이 비어있습니다");
};

// 회원가입
export const signUp = async (data) => {
    const res = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    return handleResponse(res, true, "회원가입 실패");
};

// 이메일 코드 전송
export const sendEmailCode = async (email) => {
    const res = await fetch(`${API_BASE}/email/code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });
    return handleResponse(res, false, "이메일 코드 전송 실패");
};

// 내 정보 조회 (토큰 검증 + 디버깅)
export const getMyInfo = async (token) => {
    if (!token) throw new Error("토큰이 없습니다. 다시 로그인해주세요.");

    console.log("[getMyInfo] 토큰 시작:", token.substring(0, 20) + "...");

    try {
        const res = await fetch(`${API_BASE}/me`, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });

        console.log("[getMyInfo] 상태 코드:", res.status);
        console.log("[getMyInfo] Content-Type:", res.headers.get("content-type"));

        if (!res.ok) {
            const errText = await res.text().catch(() => "");
            console.error("[getMyInfo] 응답 본문:", errText);

            let errMsg = `HTTP ${res.status}`;
            if (errText) {
                try {
                    const errJson = JSON.parse(errText);
                    errMsg = errJson.message || errMsg;
                } catch {
                    errMsg = errText || errMsg;
                }
            }

            if (res.status === 401) throw new Error(`토큰 인증 실패 (401): ${errMsg}`);
        }

        const contentType = (res.headers.get("content-type") || "").toLowerCase();
        if (contentType.includes("application/json")) {
            const data = await res.json();
            console.log("[getMyInfo] 성공:", data);
            return data;
        }

        const textData = await res.text().catch(() => null);
        if (textData) return { message: textData };
    } catch (err) {
        console.error("[getMyInfo] 에러 발생:", err.message);
        throw err;
    }
};

// 정보 수정
export const updateMember = async (token, data) => {
    const res = await fetch(`${API_BASE}/me`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });
    return handleResponse(res, true, "정보 수정 실패");
};

// 비밀번호 변경
export const changePassword = async (token, data) => {
    const res = await fetch(`${API_BASE}/me/password`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });
    return handleResponse(res, true, "비밀번호 변경 실패");
};

// 회원 탈퇴
export const deleteMember = async (token, password) => {
    const res = await fetch(`${API_BASE}/me`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
    });
    return handleResponse(res, true, "회원 탈퇴 실패");
};

// 이메일 코드 검증
export const verifyEmailCode = async (email, code) => {
    const res = await fetch(`${API_BASE}/email/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
    });
    return handleResponse(res, false, "인증 코드 확인 실패");
};