const API_BASE = "http://localhost:8080/api/post"; // 스프링 서버 주소

// 글 작성
export const createPost = async (data, token) => {
  const res = await fetch(`${API_BASE}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("글 작성 실패");
  return res.json();
};

// 글 수정
export const updatePost = async (postId, data, token) => {
  const res = await fetch(`${API_BASE}/${postId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("글 수정 실패");
  return res.json();
};

// 글 삭제
export const deletePost = async (postId, token) => {
  const res = await fetch(`${API_BASE}/${postId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error("글 삭제 실패");
  return res.json();
};

// 글 전체 조회
export const getPosts = async () => {
  const res = await fetch(`${API_BASE}`);
  if (!res.ok) throw new Error("글 전체 조회 실패");
  return res.json();
};

// 단일 글 조회
export const getPostById = async (postId) => {
  const res = await fetch(`${API_BASE}/${postId}`);
  if (!res.ok) throw new Error("글 조회 실패");
  return res.json();
};

// 내가 쓴 글 조회
export const getMyPosts = async (token) => {
  const res = await fetch(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("내 글 조회 실패");
  return res.json();
};

// 키워드 검색
export const searchPosts = async (keyword) => {
  const res = await fetch(
    `${API_BASE}/keyword?keyword=${encodeURIComponent(keyword)}`,
  );
  if (!res.ok) throw new Error("글 검색 실패");
  return res.json();
};

// 좋아요
export const likePost = async (postId, token) => {
  const res = await fetch(`${API_BASE}/like/${postId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("좋아요 실패");
  return res.json();
};

// 좋아요 취소
export const unlikePost = async (postId, token) => {
  const res = await fetch(`${API_BASE}/like/${postId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("좋아요 취소 실패");
  return res.json();
};

// 내가 좋아요한 글 목록
export const getMyLikedPosts = async (token) => {
  const res = await fetch(`${API_BASE}/like/my`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("내 좋아요 글 조회 실패");
  return res.json();
};

// 특정 글 좋아요 수 조회
export const getPostLikeCount = async (postId) => {
  const res = await fetch(`${API_BASE}/like/count/${postId}`);
  if (!res.ok) throw new Error("글 좋아요 수 조회 실패");
  return res.json();
};

// 글 임시 저장
export const saveDraft = async (data, token) => {
  const res = await fetch(`${API_BASE}/draft`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("임시 저장 실패");
  return res.json();
};

// 임시 글 불러오기
export const getDrafts = async (token) => {
  const res = await fetch(`${API_BASE}/draft`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("임시 글 조회 실패");
  return res.json();
};
