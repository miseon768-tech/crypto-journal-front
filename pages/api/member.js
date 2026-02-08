// pages/api/member.js
const API_BASE = "http://localhost:8080/api/member";

// 로그인
export const login = async (email, password) => {
  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) throw new Error("로그인 실패");
  return res.json();
};

// 회원가입
export const signUp = async (data) => {
  const res = await fetch(`${API_BASE}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error("회원가입 실패");
  return res.json();
};

// 이메일 인증 코드 전송
export const sendEmailCode = async (email) => {
  const res = await fetch(`${API_BASE}/email/code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) throw new Error("이메일 코드 전송 실패");
  return res.json();
};

// 내 정보 조회
export const getMyInfo = async (token) => {
  const res = await fetch(`${API_BASE}/me`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error("내 정보 조회 실패");
  return res.json();
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

  if (!res.ok) throw new Error("정보 수정 실패");
  return res.json();
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

  if (!res.ok) throw new Error("비밀번호 변경 실패");
  return res.json();
};

// 회원 탈퇴
export const deleteMember = async (token, password) => {
  const res = await fetch(`${API_BASE}/me`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(password),
  });

  if (!res.ok) throw new Error("회원 탈퇴 실패");
  return res.json();
};
