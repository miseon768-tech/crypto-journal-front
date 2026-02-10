import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { login, getMyInfo } from "../../api/member";
import { socialLogin } from "../../api/social";
import { useAccount, useToken } from "../../stores/account-store";
import { normalizeTokenString } from "../../api/_client";

export default function Login() {
    const router = useRouter();
    const { code, provider, state } = router.query || {};

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loginError, setLoginError] = useState(false);
    const [loginErrorMessage, setLoginErrorMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const { setAccount } = useAccount();
    const { setToken } = useToken();

    // 토큰 저장 후 서버 검증
    async function persistTokenAndFetchProfile(rawToken) {
        const token = normalizeTokenString(rawToken);
        if (!token) return { success: false, error: "토큰이 유효하지 않습니다." };

        try { localStorage.setItem("token", token); } catch (e) { console.warn("localStorage set failed", e); }
        try { setToken(token); } catch (e) { console.warn("setToken error", e); }

        const res = await getMyInfo(token);
        if (res && res.error) {
            try { localStorage.removeItem("token"); } catch {}
            try { setToken(null); } catch {}
            return { success: false, error: res.error };
        }

        let payload = res?.data || res;
        if (payload?.member) payload = payload.member;
        if (payload?.data) payload = payload.data;

        try { setAccount(payload || null); } catch (e) { console.warn("setAccount error", e); }

        return { success: true, payload };
    }

    // 일반 로그인
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
            const tokenResult = hasMemberInfo
                ? (() => {
                    const token = normalizeTokenString(rawToken);
                    localStorage.setItem("token", token);
                    setToken(token);
                    const account = obj.member || { id: obj.id, email: obj.email, nickname: obj.nickname };
                    setAccount(account);
                    return { success: true };
                })()
                : await persistTokenAndFetchProfile(rawToken);

            if (!tokenResult.success) {
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

    // 소셜 로그인 처리
    useEffect(() => {
        if (!code || !provider) return;

        const handleSocialCallback = async () => {
            setLoading(true);
            setLoginError(false);

            try {
                const redirectUri =
                    provider === "google"
                        ? process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI
                        : process.env.NEXT_PUBLIC_NAVER_REDIRECT_URI;

                const data = await socialLogin({ provider, code, state, redirectUri });
                const rawToken = data?.token || data?.accessToken;

                if (!rawToken) {
                    setLoginError(true);
                    setLoginErrorMessage(data?.message || "소셜 로그인 실패: 토큰 없음");
                    return;
                }

                const accountFromSocial = data?.member || (data?.id || data?.email ? { id: data.id, email: data.email, nickname: data.nickname } : null);
                const tokenResult = accountFromSocial
                    ? (() => {
                        const token = normalizeTokenString(rawToken);
                        localStorage.setItem("token", token);
                        setToken(token);
                        setAccount(accountFromSocial);
                        return { success: true };
                    })()
                    : await persistTokenAndFetchProfile(rawToken);

                if (!tokenResult.success) {
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
    }, [code, provider, state]);

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
                        <a href={`https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI + '?provider=google')}&response_type=code&scope=profile%20email`} className="block">
                            <img src="/web_light_rd_ctn@2x.png" className="w-full h-11 object-contain opacity-90 hover:opacity-100 transition" />
                        </a>
                        <a href={`https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${process.env.NEXT_PUBLIC_NAVER_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_NAVER_REDIRECT_URI + '?provider=naver')}&state=${Math.random().toString(36).substring(2)}`} className="block">
                            <img src="/NAVER_login_Dark_KR_green_center_H48.png" className="w-full h-11 object-contain opacity-90 hover:opacity-100 transition" />
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}