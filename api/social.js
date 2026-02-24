// api/social.js — 백엔드 `/api/member/social` 엔드포인트에 맞게 정리
const apiAddress = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

export async function socialLogin({ provider, code, state, redirectUri }) {
    const p = (provider || "").toString().toUpperCase();
    const encodedCode = encodeURIComponent(code || "");
    const fallbackRedirectUri = p === "GOOGLE" ? process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI : process.env.NEXT_PUBLIC_NAVER_REDIRECT_URI;
    const actualRedirectUri = redirectUri || fallbackRedirectUri || "";

    // 백엔드 컨트롤러: GET /api/member/social?provider=...&code=...&redirectUri=...&state=...
    const url =
        `${apiAddress}/api/member/social` +
        `?provider=${encodeURIComponent(p)}` +
        `&code=${encodedCode}` +
        `${actualRedirectUri ? `&redirectUri=${encodeURIComponent(actualRedirectUri)}` : ""}` +
        `${state ? `&state=${encodeURIComponent(state)}` : ""}`;

    console.log("=== 소셜 로그인 요청 URL ===", url);

    const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json, text/plain, */*" },
    });

    console.log("=== 소셜 로그인 응답 상태 ===", res.status);
    console.log("=== 소셜 로그인 응답 헤더 ===", Array.from(res.headers.entries()));

    const bodyText = await res.text();
    console.log("=== 소셜 로그인 응답 원문(bodyText) ===");
    console.log(bodyText);

    let body;
    try {
        body = bodyText ? JSON.parse(bodyText) : null;
    } catch (e) {
        body = bodyText;
    }

    if (!res.ok) {
        // 추가 디버그: 응답이 HTML(google error 등)일 경우 첫 1000자만 출력
        const debugBody = typeof body === 'string'
            ? (body.length > 1000 ? body.substring(0, 1000) + '...' : body)
            : JSON.stringify(body);
        console.error("소셜 로그인 에러 응답 본문(parsed):", body);
        console.error("소셜 로그인 에러 - debugBodySnippet:", debugBody);
        const errMsg = (body && (body.message || JSON.stringify(body))) || bodyText || `HTTP ${res.status}`;
        const err = new Error(`소셜 로그인 실패 (${res.status}): ${errMsg}`);
        err.status = res.status;
        err.body = body;
        throw err;
    }

    return body;
}