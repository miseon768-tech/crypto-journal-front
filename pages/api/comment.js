import { authHeader } from './_client';

const API_BASE = "http://localhost:8080/api/comment";

// 댓글 작성
export const addComment = async (data, token) => {
  const headers = {
    "Content-Type": "application/json",
    ...authHeader(token),
  };

  const res = await fetch(`${API_BASE}`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("댓글 작성 실패");
  return res.json();
};

// 댓글 수정
export const updateComment = async (commentId, content, token) => {
  const headers = {
    "Content-Type": "application/json",
    ...authHeader(token),
  };

  const res = await fetch(`${API_BASE}/${commentId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(content),
  });
  if (!res.ok) throw new Error("댓글 수정 실패");
  return res.json();
};

// 댓글 삭제
export const deleteComment = async (commentId, token) => {
  const headers = {
    ...authHeader(token),
  };

  const res = await fetch(`${API_BASE}/${commentId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error("댓글 삭제 실패");
  return res.json();
};

// 특정 글 댓글 목록 조회
export const getCommentsByPost = async (postId) => {
  const res = await fetch(`${API_BASE}/${postId}`);
  if (!res.ok) throw new Error("댓글 목록 조회 실패");
  return res.json();
};

// 사용자 댓글 목록 조회
export const getCommentsByUser = async (token) => {
  const headers = {
    ...authHeader(token),
  };
  const res = await fetch(`${API_BASE}/user`, {
    headers,
  });
  if (!res.ok) throw new Error("사용자 댓글 조회 실패");
  return res.json();
};
