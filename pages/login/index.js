import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { login as loginApi } from "../../api/member";
import { useAccount, useToken } from "../../stores/account-store";

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

    async function submitHandle(evt) {
        evt.preventDefault();
        setLoginError(false);
        setLoading(true);

        try {
            const res = await loginApi(email, password);
            const token = res?.token;
            const member = res?.member;

            if (!token || !member) {
                setLoginError(true);
                setLoginErrorMessage("로그인 실패: 응답값 오류 (token/member 없음)");
                return;
            }

            localStorage.setItem("token", token);
            setToken(token);
            setAccount(member);

            router.push("/dashboard");
        } catch (err) {
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
                const origin = (typeof window !== 'undefined' && window.location.origin) || '';
                const redirectUri = queryRedirectUri ? decodeURIComponent(queryRedirectUri) : `${origin}/${provider}/callback`;
                const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://43.201.97.58.nip.io:8081";
                const url = `${backendUrl}/api/auth/${provider}?code=${encodeURIComponent(code)}&redirectUri=${encodeURIComponent(redirectUri)}`;

                const res = await fetch(url);
                const data = await res.json();

                const token = data?.token;
                const member = data?.member;

                if (!token || !member) {
                    setLoginError(true);
                    setLoginErrorMessage(data?.message || "소셜 로그인 실패: token/member 없음");
                    return;
                }

                localStorage.setItem("token", token);
                setToken(token);
                setAccount(member);

                router.push("/dashboard");
            } catch (err) {
                setLoginError(true);
                setLoginErrorMessage(err?.message || JSON.stringify(err));
            } finally {
                setLoading(false);
            }
        };

        handleSocialCallback();
    }, [code, provider, state, queryRedirectUri]);

    const isValidClientId = (id) => !!id && !/your-|placeholder|example|undefined/i.test(id);

    return (
        <div className="min-h-screen flex items-center justify-center px-6">
            <div className="w-full max-w-md">
                <div className="mb-10 text-center">
                    <h1 className="text-3xl font-bold tracking-wide">Crypto Journal</h1>
                    <p className="text-gray-400 text-sm mt-2">당신의 크립토 여정을 기록하세요</p>
                </div>

                <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-8 shadow-2xl">
                    <form onSubmit={submitHandle} className="space-y-6">
                        <div>
                            <label className="block text-s text-gray-400 mb-2">이메일</label>
                            <input
                                type="email"
                                placeholder="example@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-s text-gray-400 mb-2">비밀번호</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                                required
                            />
                        </div>
                        {loginError && <p className="text-xs text-red-400">{loginErrorMessage}</p>}

                        <div className="space-y-4 mt-4">
                            {/* 일반 로그인 */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 rounded-xl bg-black from-neutral-700 via-neutral-600 to-neutral-700 hover:from-neutral-600 hover:via-neutral-500 hover:to-neutral-600 transition duration-300 shadow-lg hover:shadow-xl font-medium"
                            >
                                {loading ? "로그인 중..." : "Crypto Journal로 시작하기"}
                            </button>

                            {/* Google Login */}
                            <button
                                type="button"
                                onClick={() => {
                                    const origin = typeof window !== "undefined" ? window.location.origin : "";
                                    const redirect = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI || `${origin}/google/callback`;
                                    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
                                    if (!isValidClientId(clientId)) {
                                        alert("Google 클라이언트 ID 미설정 또는 placeholder 사용");
                                        return;
                                    }
                                    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
                                        clientId
                                    )}&redirect_uri=${encodeURIComponent(
                                        redirect
                                    )}&response_type=code&scope=${encodeURIComponent("profile email")}`;
                                    window.location.href = url;
                                }}
                                className="w-full py-3 rounded-xl flex items-center justify-center gap-3 bg-black text-white hover:scale-[1.02] transition shadow hover:shadow-lg"
                            >
                                <img src="/web_dark_sq_na.svg" alt="Google" className="h-6 w-6" />
                                <span>구글로 시작하기</span>
                            </button>

                            {/* Naver Login */}
                            <button
                                type="button"
                                onClick={() => {
                                    const origin = typeof window !== "undefined" ? window.location.origin : "";
                                    const redirect = process.env.NEXT_PUBLIC_NAVER_REDIRECT_URI || `${origin}/naver/callback`;
                                    const clientId = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID || "";
                                    if (!isValidClientId(clientId)) {
                                        alert("Naver 클라이언트 ID 미설정 또는 placeholder 사용");
                                        return;
                                    }
                                    const stateVal = Math.random().toString(36).substring(2);
                                    const url = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${encodeURIComponent(
                                        clientId
                                    )}&redirect_uri=${encodeURIComponent(redirect)}&state=${encodeURIComponent(stateVal)}`;
                                    window.location.href = url;
                                }}
                                className="w-full py-3 rounded-xl flex items-center justify-center gap-3 bg-black text-white hover:scale-[1.02] transition shadow hover:shadow-lg"
                            >
                                <img src="/NAVER_login_Dark_KR_white_icon_H56.png" alt="Naver" className="h-6 w-6" />
                                <span>네이버로 시작하기</span>
                            </button>
                        </div>

                        {/* 회원가입 링크 */}
                        <div className="mt-6 flex justify-end text-sm text-gray-400">
                            <span>아이디가 없으신가요? </span>
                            <button
                                type="button"
                                onClick={() => router.push("/signup")}
                                className="ml-1 text-gray-400 underline hover:text-blue-500 transition-colors duration-200"
                            >
                                회원가입하기
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}