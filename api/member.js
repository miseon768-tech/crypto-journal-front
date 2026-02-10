import { getStoredToken, normalizeTokenString } from './_client';

const API_HOST = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
const API_BASE = `${API_HOST.replace(/\/$/, '')}/api/member`;

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
    if (contentType.includes("application/json")) {
        const json = await res.json();
        // 서버가 { token: '...' } 또는 { success: true, token: '...' } 형태로 주는 경우
        if (json && (json.token || json.accessToken)) {
            const raw = String(json.token || json.accessToken);
            const token = normalizeTokenString(raw);
            return { ...json, token };
        }
        return json;
    }
    const textData = await res.text().catch(() => null);
    if (textData) {
        const token = normalizeTokenString(textData);
        return { token };
    }
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
    const rawToken = getStoredToken(token);
    if (!rawToken) {
        return { error: { status: null, message: "토큰이 없습니다. 다시 로그인해주세요." } };
    }

    // 토큰은 이미 정규화됨
    console.log("내 정보 조회 요청 - 토큰:", rawToken.substring(0, 20) + "...");
    console.log("Authorization 헤더:", `Bearer ${rawToken.substring(0, 20)}...`);

    try {
        const res = await fetch(`${API_BASE}/me`, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${rawToken}`,
            },
        });

        console.log("내 정보 조회 응답 상태:", res.status);
        console.log("내 정보 조회 응답 Content-Type:", res.headers.get("content-type"));

        if (!res.ok) {
            const errText = await res.text().catch(() => null);
            console.error("내 정보 조회 응답 본문:", errText);

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

            // 반환: 에러 객체 (throw 하지 않음) - token 스니펫 포함
            return { error: { status: res.status, message: errMsg, body: errJson || errText, tokenSnippet: rawToken.substring(0, 20) + '...' } };
        }

        // 정상 응답: JSON 파싱을 시도하고, 객체가 아니면 에러 객체 반환
        let data = null;
        try {
            data = await res.json().catch(() => null);
        } catch (parseErr) {
            const txt = await res.text().catch(() => null);
            console.error('getMyInfo: JSON 파싱 실패, 본문:', txt, parseErr);
            return { error: { status: null, message: '내 정보 응답을 파싱할 수 없습니다.', body: txt, tokenSnippet: rawToken.substring(0, 20) + '...' } };
        }

        console.log("내 정보 조회 성공 (raw):", data);

        if (!data || typeof data !== 'object') {
            console.error('getMyInfo: 응답 데이터가 비어있거나 객체가 아님', data);
            return { error: { status: null, message: '내 정보 응답이 비어있습니다. 다시 로그인해주세요.', body: data, tokenSnippet: rawToken.substring(0, 20) + '...' } };
        }

        return { data, tokenSnippet: rawToken.substring(0, 20) + '...' };
    } catch (err) {
        console.error("getMyInfo 에러(정리):", err, err.body || err.message);
        return { error: { status: null, message: err.message || '내 정보 조회 중 오류', body: null } };
    }
};

// 정보 수정
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

// 비밀번호 변경
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

// 회원 탈퇴
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

// 이메일 코드 검증
export const verifyEmailCode = async (email, code) => {
    const res = await fetch(`${API_BASE}/email/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
    });
    return handleResponse(res, false, "인증 코드 확인 실패");
};