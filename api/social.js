export async function socialLogin(provider, code, redirectUri) {
    const apiAddress = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://43.201.97.58.nip.io:8081").replace(/\/$/, '');
    const url = `${apiAddress}/api/auth/${provider}?code=${encodeURIComponent(code)}&redirectUri=${encodeURIComponent(redirectUri)}`;

    let response;
    try {
        response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
    } catch (networkErr) {
        const e = new Error('네트워크 에러: 소셜 로그인 요청에 실패했습니다. (네트워크)');
        e.cause = networkErr;
        throw e;
    }

    let data;
    try {
        data = await response.json();
    } catch (e) {
        data = null;
    }

    if (!response.ok) {
        const msg = (data && (data.message || data.error)) || `HTTP ${response.status}`;
        const err = new Error(`소셜 로그인 실패 (${response.status}): ${msg}`);
        err.status = response.status;
        err.body = data;
        throw err;
    }

    const token = data?.token || data?.accessToken || data?.access_token || null;
    if (token && typeof token === 'string') {
        try { localStorage.setItem('token', token); } catch (e) { /* ignore */ }
    } else if (token) {
        // 토큰이 객체로 왔다면 태그해서 디버그, 그러나 정상 동작을 위해 문자열로 변환 시도
        try { const maybe = typeof token === 'object' ? (token.token || token.accessToken || token.access_token) : String(token); if (maybe && typeof maybe === 'string') localStorage.setItem('token', maybe); }
        catch (e) { console.warn('[socialLogin] token not string', token); }
    }

    return data;
}