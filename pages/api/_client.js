// 공통 API 클라이언트 유틸리티
// 브라우저에서 localStorage에 저장된 토큰을 읽어 정규화하여 반환합니다.
export function normalizeTokenString(raw) {
  if (!raw) return raw;
  let t = String(raw).trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.substring(1, t.length - 1).trim();
  }
  if (t.toLowerCase().startsWith('bearer ')) {
    t = t.substring(7).trim();
  }
  return t;
}

export function getStoredToken(token) {
  let t = token;
  if (!t && typeof window !== 'undefined' && window.localStorage) {
    t = window.localStorage.getItem('token');
  }
  return normalizeTokenString(t);
}

export function authHeader(token) {
  const t = getStoredToken(token);
  if (!t) return {};
  return { Authorization: `Bearer ${t}` };
}

