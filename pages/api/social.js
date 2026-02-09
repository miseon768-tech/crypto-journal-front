// pages/api/social.js
export async function socialLogin({ provider, code, state, redirectUri }) {
  const url =
    provider === "google"
      ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/google?code=${code}&redirectUri=${encodeURIComponent(redirectUri)}`
      : `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/naver?code=${code}&state=${state}`;

  console.log("소셜 로그인 요청 URL:", url);

  const res = await fetch(url);

  console.log("소셜 로그인 응답 상태:", res.status);
  console.log("소셜 로그인 응답 Content-Type:", res.headers.get("content-type"));

  if (!res.ok) {
    const errorText = await res.text();
    console.error("소셜 로그인 에러:", errorText);
    throw new Error(`소셜 로그인 실패 (${res.status}): ${errorText}`);
  }

  return res.json();
}
