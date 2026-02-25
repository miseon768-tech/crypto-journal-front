import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { login as loginApi } from "../../api/member"; // getMyInfo 등은 필요에 따라 추가
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

    // 일반 로그인
    async function submitHandle(evt) {
        evt.preventDefault();
        setLoginError(false);
        setLoading(true);

        try {
            const res = await loginApi(email, password);
            console.log("로그인 응답값:", res);

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

            // token 저장 검증 로그
            console.log("저장된 토큰(localStorage):", localStorage.getItem("token"));

            router.push("/dashboard");
        } catch (err) {
            console.error("로그인 실패", err);
            setLoginError(true);
            setLoginErrorMessage(err?.message || JSON.stringify(err));
        } finally {
            setLoading(false);
        }
    }

    // 소셜 로그인 콜백 처리
    useEffect(() => {
        if (!code || !provider) return;

        const handleSocialCallback = async () => {
            setLoading(true);
            setLoginError(false);

            try {
                const origin = (typeof window !== 'undefined' && window.location.origin) || '';
                const redirectUri = queryRedirectUri ? decodeURIComponent(queryRedirectUri) : `${origin}/${provider}/callback`;

                const url = `http://localhost:8080/api/auth/${provider}?code=${encodeURIComponent(code)}&redirectUri=${encodeURIComponent(redirectUri)}`;

                const res = await fetch(url);
                const data = await res.json();

                console.log("소셜 로그인 응답값:", data);

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

                // token 저장 검증 로그
                console.log("저장된 토큰(localStorage):", localStorage.getItem("token"));

                router.push("/dashboard");
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

    const isValidClientId = (id) => !!id && !/your-|placeholder|example|undefined/i.test(id);

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
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-neutral-700 via-neutral-600 to-neutral-700 hover:from-neutral-600 hover:via-neutral-500 hover:to-neutral-600 transition duration-300 shadow-lg hover:shadow-xl font-medium"
                        >
                            {loading ? "로그인 중..." : "로그인"}
                        </button>
                    </form>

                    <div className="mt-6">
                        <button
                            type="button"
                            onClick={() => router.push("/signup")}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-neutral-700 via-neutral-600 to-neutral-700 hover:from-neutral-600 hover:via-neutral-500 hover:to-neutral-600 transition duration-300 shadow-lg hover:shadow-xl font-medium"
                        >
                            회원가입
                        </button>
                    </div>

                    <div className="mt-6 space-y-3">
                        <button
                            type="button"
                            onClick={() => {
                                const origin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "";
                                const redirect =
                                    process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI ||
                                    `${origin}/google/callback`;
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
                            className="block"
                        >
                            <img
                                src="/web_light_rd_ctn@2x.png"
                                className="w-full h-11 object-contain opacity-90 hover:opacity-100 transition"
                            />
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                const origin =
                                    typeof window !== "undefined" && window.location.origin
                                        ? window.location.origin
                                        : "";
                                const redirect =
                                    process.env.NEXT_PUBLIC_NAVER_REDIRECT_URI ||
                                    `${origin}/naver/callback`;
                                const clientId = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID || "";
                                if (!isValidClientId(clientId)) {
                                    alert("Naver 클라이언트 ID 미설정 또는 placeholder 사용");
                                    return;
                                }
                                const state = Math.random().toString(36).substring(2);
                                const url = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${encodeURIComponent(
                                    clientId
                                )}&redirect_uri=${encodeURIComponent(
                                    redirect
                                )}&state=${encodeURIComponent(state)}`;
                                window.location.href = url;
                            }}
                            className="block"
                        >
                            <img
                                src="/NAVER_login_Dark_KR_green_center_H48.png"
                                className="w-full h-11 object-contain opacity-90 hover:opacity-100 transition"
                            />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}