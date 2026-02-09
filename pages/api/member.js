const API_BASE = "http://localhost:8080/api/member";

// 공통 응답 처리: 실패 시 JSON 또는 텍스트를 시도해 에러 메시지 생성
async function handleResponse(
  res,
  expectJson = false,
  fallbackMessage = "요청 실패",
) {
  if (!res.ok) {
    // 에러 메시지 본문(JSON 또는 텍스트)을 파싱해 Error에 붙여 던짐
    let errBody = null;
    try {
      errBody = await res.json();
    } catch (parseErr) {
      // JSON 파싱 실패 — 이후 텍스트로 시도
      errBody = null;
    }

    if (errBody) {
      const message =
        errBody.message || JSON.stringify(errBody) || fallbackMessage;
      const error = new Error(message);
      error.status = res.status;
      error.body = errBody;
      throw error;
    }

    const text = await res.text().catch(() => null);
    const message = text || fallbackMessage;
    const error = new Error(message);
    error.status = res.status;
    error.body = text;
    throw error;
  }

  if (expectJson) {
    return res.json();
  }

  // 기본적으로 텍스트 반환 시도
  return res.text().catch(() => null);
}

// 로그인
export const login = async (email, password) => {
  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  // handleResponse를 사용하되, 성공 시 응답 타입을 확인
  if (!res.ok) {
    return handleResponse(res, false, "로그인 실패");
  }

  // 성공 시: Content-Type 확인
  const contentType = (res.headers.get("content-type") || "").toLowerCase();

  if (contentType.includes("application/json")) {
    return res.json();
  }

  // 기본적으로 텍스트(토큰 문자열)로 처리
  return res.text().catch(() => null);
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

// 이메일 인증 코드 전송
export const sendEmailCode = async (email) => {
  const res = await fetch(`${API_BASE}/email/code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return handleResponse(res, false, "이메일 코드 전송 실패");
};

// 내 정보 조회
export const getMyInfo = async (token) => {
  const res = await fetch(`${API_BASE}/me`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  return handleResponse(res, true, "내 정보 조회 실패");
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
    // 서버가 객체 형태를 기대할 수 있으므로 객체로 감싸기
    body: JSON.stringify({ password }),
  });
  return handleResponse(res, true, "회원 탈퇴 실패");
};

// 이메일 인증 코드 확인
export const verifyEmailCode = async (email, code) => {
  const res = await fetch(`${API_BASE}/email/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  return handleResponse(res, false, "인증 코드 확인 실패");
};
