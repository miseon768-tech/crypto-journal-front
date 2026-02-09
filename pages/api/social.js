// pages/api/social.js
export async function socialLogin({ provider, code, state, redirectUri }) {
  const url =
    provider === "google"
      ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/google?code=${code}&redirectUri=${redirectUri}`
      : `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/naver?code=${code}&state=${state}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("소셜 로그인 실패");
  return res.json();
}
