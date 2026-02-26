export async function socialLogin(provider, code, redirectUri) {
    const apiAddress = "http://43.201.97.58.nip.io:8081";
    const url = `${apiAddress}/api/auth/${provider}?code=${encodeURIComponent(code)}&redirectUri=${encodeURIComponent(redirectUri)}`;

    const response = await fetch(url);

    let data;
    try {
        data = await response.json();
    } catch (e) {
        data = { message: '소셜 로그인 실패', error: true };
    }

    if (!response.ok) {
        throw data;
    }

    const token = data.token || data.accessToken || data.access_token;
    if (token) {
        localStorage.setItem("token", token);
    } else {
        console.warn("[socialLogin] 응답에 token 없음!", data);
    }

    return data;
}