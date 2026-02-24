import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { login, getMyInfo } from "../../api/member";
import { socialLogin } from "../../api/social";
import { useAccount, useToken } from "../../stores/account-store";

// Debug: show env vars available in client build/runtime
if (typeof window !== 'undefined') {
  console.log('[login page] NEXT_PUBLIC_BACKEND_URL=', process.env.NEXT_PUBLIC_BACKEND_URL);
  console.log('[login page] NEXT_PUBLIC_GOOGLE_CLIENT_ID=', process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
  console.log('[login page] NEXT_PUBLIC_NAVER_CLIENT_ID=', process.env.NEXT_PUBLIC_NAVER_CLIENT_ID);
  console.log('[login page] NEXT_PUBLIC_BASE_URL=', process.env.NEXT_PUBLIC_BASE_URL);
}

export default function Login() {
    const router = useRouter();
    const { code, provider, state, redirectUri: queryRedirectUri } = router.query || {};

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loginError, setLoginError] = useState(false);
    const [loginErrorMessage, setLoginErrorMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const { setAccount } = useAccount();
    const { setToken } = useToken();

    const normalizeTokenString = (token) => {
        if (!token && token !== "") return null;
        try {
            if (typeof token === 'string') {
                const t = token.trim();
                if (!t) return null;
                if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('\"{') && t.endsWith('}\"'))) {
                    try {
                        const parsed = JSON.parse(t);
                        if (parsed && typeof parsed === 'object') {
                            if (parsed.token) return String(parsed.token).trim();
                            if (parsed.accessToken) return String(parsed.accessToken).trim();
                            if (parsed.value) return String(parsed.value).trim();
                            if (parsed.data && parsed.data.token) return String(parsed.data.token).trim();
                        }
                    } catch (e) {}
                }
                return t;
            }
            if (typeof token === 'object') {
                if (token.token) return String(token.token).trim();
                if (token.accessToken) return String(token.accessToken).trim();
                if (token.value) return String(token.value).trim();
                if (token.data && token.data.token) return String(token.data.token).trim();
                try { return JSON.stringify(token).trim(); } catch (e) { return null; }
            }
            return String(token).trim();
        } catch (e) {
            return null;
        }
    };

    async function persistTokenAndFetchProfile(rawToken) {
        const token = normalizeTokenString(rawToken);
        if (!token) return { success: false, error: "토큰이 유효하지 않습니다." };

        try { localStorage.setItem("token", token); } catch (e) { console.warn("localStorage set failed", e); }
        try { setToken(token); } catch (e) { console.warn("setToken error", e); }

        const res = await getMyInfo(token).catch((e) => {
            console.warn("getMyInfo 실패 (persistTokenAndFetchProfile):", e);
            return { __error: true, error: e };
        });

        if (res && res.__error) {
            // 서버가 사소한 형식 문제로 실패하거나 토큰이 유효하지만 프로필 조회가 실패하는 경우
            // 안전하게 토큰은 저장해 두고 호출자에서 폴백 처리할 수 있게 실패를 알려줍니다.
            return { success: false, error: res.error || "프로필 조회 실패", token };
        }

        let payload = res?.data || res;
        if (payload?.member) payload = payload.member;
        if (payload?.data) payload = payload.data;

        try { setAccount(payload || null); } catch (e) { console.warn("setAccount error", e); }

        return { success: true, payload };
    }

    async function submitHandle(evt) {
        evt.preventDefault();
        setLoginError(false);
        setLoading(true);

        try {
            const res = await login(email, password);
            let obj = typeof res === "string" ? JSON.parse(res || "{}") : res;

            const rawToken = obj?.token || obj?.accessToken;
            if (!rawToken) {
                setLoginError(true);
                setLoginErrorMessage("로그인 응답에 토큰이 없습니다.");
                return;
            }

            const hasMemberInfo = obj?.member || obj?.id || obj?.email || obj?.nickname;

            let tokenResult;
            if (hasMemberInfo) {
                // 토큰과 계정 정보가 같이 왔으면 간단히 저장
                try {
                    const token = normalizeTokenString(rawToken);
                    localStorage.setItem("token", token);
                    try { setToken(token); } catch (e) { console.warn("setToken error on quick path", e); }
                    const account = obj.member || { id: obj.id, email: obj.email, nickname: obj.nickname };
                    try { setAccount(account); } catch (e) { console.warn("setAccount error on quick path", e); }
                    tokenResult = { success: true };
                } catch (e) {
                    tokenResult = { success: false, error: e };
                }
            } else {
                tokenResult = await persistTokenAndFetchProfile(rawToken);
            }

            if (!tokenResult.success) {
                // 엄격 모드: 실패하면 로그인 실패 처리
                // 하지만 소셜/타입 문제로 프로필 조회만 실패한 경우 토큰은 이미 저장되어 있을 수 있으므로
                // 사용자가 원하면 임시로 계속 진행하도록 폴백을 제공합니다.
                console.warn("토큰 검증/프로필 조회 실패. tokenResult:", tokenResult);

                // 폴백: 토큰 문자열이 있으면 그대로 저장하고 대시보드 진입 (사용자가 수동으로 로그아웃/재로그인 가능)
                if (tokenResult.token) {
                    try { localStorage.setItem("token", tokenResult.token); } catch (e) {}
                    try { setToken(tokenResult.token); } catch (e) {}
                    // 계정이 없는 경우 빈 계정으로 세팅(백엔드에서 /me 호출 시 재확인 권장)
                    try { setAccount(null); } catch (e) {}
                    router.push("/dashboard");
                    return;
                }

                setLoginError(true);
                setLoginErrorMessage(tokenResult.error?.message || tokenResult.error || "토큰 검증 실패");
                return;
            }

            router.push("/dashboard");
        } catch (err) {
            console.error("로그인 실패", err);
            setLoginError(true);
            setLoginErrorMessage(err?.message || JSON.stringify(err));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!code || !provider) return;

        const handleSocialCallback = async () => {
            setLoading(true);
            setLoginError(false);

            try {
                // 변경: 프론트에서 실제로 사용된 redirect URI (브라우저 origin 기반)를 우선 사용합니다.
                // 이유: 사용자가 auth 요청을 보낼 때 대부분 window.location.origin + '/google/callback' 같은 값을 사용하므로,
                // token 교환 시에도 동일 값을 보내야 redirect_uri_mismatch 를 피할 수 있습니다.
                const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : (process.env.NEXT_PUBLIC_BASE_URL || '');
                const defaultRedirectForProvider = `${origin}/${provider}` + "/callback";

                const redirectUri =
                    queryRedirectUri ||
                    // 우선 브라우저 origin 기반 default를 사용하고, 그 값이 없을 때만 환경변수에 의존합니다.
                    (typeof window !== 'undefined' ? defaultRedirectForProvider : (provider === "google" ? process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI : process.env.NEXT_PUBLIC_NAVER_REDIRECT_URI));

                console.log("소셜 콜백 처리 시작, provider:", provider, "code:", code, "redirectUri:", redirectUri);

                const data = await socialLogin({ provider, code, state, redirectUri });
                console.log("socialLogin returned:", data);
                const rawToken = data?.token || data?.accessToken;

                if (!rawToken) {
                    setLoginError(true);
                    setLoginErrorMessage(data?.message || "소셜 로그인 실패: 토큰 없음");
                    return;
                }

                const accountFromSocial = data?.member || (data?.id || data?.email ? { id: data.id, email: data.email, nickname: data.nickname } : null);

                let tokenResult;
                if (accountFromSocial) {
                    try {
                        const token = normalizeTokenString(rawToken);
                        localStorage.setItem("token", token);
                        try { setToken(token); } catch (e) { console.warn("setToken error on social quick path", e); }
                        try { setAccount(accountFromSocial); } catch (e) { console.warn("setAccount error on social quick path", e); }
                        tokenResult = { success: true };
                    } catch (e) {
                        tokenResult = { success: false, error: e };
                    }
                } else {
                    tokenResult = await persistTokenAndFetchProfile(rawToken);
                }

                if (!tokenResult.success) {
                    console.warn("소셜 토큰 검증/프로필 조회 실패:", tokenResult);
                    if (tokenResult.token) {
                        try { localStorage.setItem("token", tokenResult.token); } catch (e) {}
                        try { setToken(tokenResult.token); } catch (e) {}
                        try { setAccount(null); } catch (e) {}
                        router.push("/mypage");
                        return;
                    }

                    setLoginError(true);
                    setLoginErrorMessage(tokenResult.error?.message || tokenResult.error || "토큰 검증 실패");
                    return;
                }

                router.push("/mypage");
            } catch (err) {
                console.error("소셜 로그인 처리 실패", err);
                setLoginError(true);
                setLoginErrorMessage(err?.message || JSON.stringify(err));
            } finally {
                setLoading(false);
            }
        };

        handleSocialCallback();
    }, [code, provider, state, queryRedirectUri]);

    function isValidClientId(id) {
      if (!id) return false;
      const lower = String(id).toLowerCase();
      if (lower.includes('your-') || lower.includes('placeholder') || lower.includes('example') || lower.includes('undefined')) return false;
      return true;
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-6">
            <div className="w-full max-w-md">
                <div className="mb-10 text-center">
                    <h1 className="text-3xl font-bold tracking-wide">Crypto Journal</h1>
                    <p className="text-gray-400 text-sm mt-2">당신의 크립토 여정을 기록하세요</p>
                </div>

                <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-8 shadow-2xl">
                    <form className="space-y-6" onSubmit={submitHandle}>
                        <div>
                            <label className="block text-s text-gray-400 mb-2">이메일</label>
                            <input type="email" placeholder="example@email.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" required />
                        </div>
                        <div>
                            <label className="block text-s text-gray-400 mb-2">비밀번호</label>
                            <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" required />
                        </div>

                        {loginError && <p className="text-xs text-red-400">{loginErrorMessage}</p>}

                        <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-gradient-to-r from-neutral-700 via-neutral-600 to-neutral-700 hover:from-neutral-600 hover:via-neutral-500 hover:to-neutral-600 transition duration-300 shadow-lg hover:shadow-xl font-medium">
                            {loading ? "로그인 중..." : "로그인"}
                        </button>
                    </form>

                    <div className="mt-6">
                        <button type="button" onClick={() => router.push("/signup")} className="w-full py-3 rounded-xl bg-gradient-to-r from-neutral-700 via-neutral-600 to-neutral-700 hover:from-neutral-600 hover:via-neutral-500 hover:to-neutral-600 transition duration-300 shadow-lg hover:shadow-xl font-medium">
                            회원가입
                        </button>
                    </div>

                    <div className="mt-6 space-y-3">
                        {/* social links: runtime origin을 사용해서 redirect_uri가 정확히 일치하도록 변경 */}
                        <button
                            type="button"
                            onClick={() => {
                                const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : (process.env.NEXT_PUBLIC_BASE_URL || '');
                                const redirect = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI || `${origin}/google/callback`;
                                const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
                                if (!isValidClientId(clientId)) {
                                    const msg = '구글 클라이언트 ID가 설정되어 있지 않거나 테스트 플레이스홀더가 들어있습니다. .env.local에 NEXT_PUBLIC_GOOGLE_CLIENT_ID를 설정하고, 백엔드에도 GOOGLE_CLIENT_ID/SECRET을 설정하세요. 아래의 redirect URI를 Google 콘솔에 등록해 주세요:';
                                    console.error('[login] Google login blocked - missing or placeholder client id');
                                    const redirectMsg = `redirect URI: ${redirect}`;
                                    alert(`${msg}\n\n${redirectMsg}`);
                                    try { navigator.clipboard && navigator.clipboard.writeText(redirect); console.log('[login] redirect URI copied to clipboard'); } catch (e) {}
                                    return;
                                }
                                const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&scope=${encodeURIComponent('profile email')}`;
                                window.location.href = url;
                            }}
                            className="block"
                        >
                            <img src="/web_light_rd_ctn@2x.png" className="w-full h-11 object-contain opacity-90 hover:opacity-100 transition" />
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : (process.env.NEXT_PUBLIC_BASE_URL || '');
                                const redirect = process.env.NEXT_PUBLIC_NAVER_REDIRECT_URI || `${origin}/naver/callback`;
                                const clientId = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID || '';
                                if (!isValidClientId(clientId)) {
                                    const msg = '네이버 클라이언트 ID가 설정되어 있지 않거나 테스트 플레이스홀더가 들어있습니다. .env.local에 NEXT_PUBLIC_NAVER_CLIENT_ID를 설정하고, 백엔드에도 NAVER_CLIENT_ID/SECRET을 설정하세요. 아래의 redirect URI를 네이버 개발자센터에 등록해 주세요:';
                                    console.error('[login] Naver login blocked - missing or placeholder client id');
                                    const redirectMsg = `redirect URI: ${redirect}`;
                                    alert(`${msg}\n\n${redirectMsg}`);
                                    try { navigator.clipboard && navigator.clipboard.writeText(redirect); console.log('[login] redirect URI copied to clipboard'); } catch (e) {}
                                    return;
                                }
                                const state = Math.random().toString(36).substring(2);
                                const url = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirect)}&state=${encodeURIComponent(state)}`;
                                window.location.href = url;
                            }}
                            className="block"
                        >
                            <img src="/NAVER_login_Dark_KR_green_center_H48.png" className="w-full h-11 object-contain opacity-90 hover:opacity-100 transition" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

