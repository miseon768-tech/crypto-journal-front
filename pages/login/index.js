import {useState, useEffect} from "react";
import {useRouter} from "next/router";
import {login} from "../api/member";
import {socialLogin} from "../api/social";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [pasteToken, setPasteToken] = useState(""); // 추가: 토큰 붙여넣기 상태

    const {code, provider, state} = router.query;

    useEffect(() => {
        if (!code || !provider) return;

        const fetchOAuthToken = async () => {
            try {
                const redirectUri = provider === "google" ? process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI : process.env.NEXT_PUBLIC_NAVER_REDIRECT_URI;

                const data = await socialLogin({provider, code, state, redirectUri});

                console.log("소셜 로그인 응답:", data);

                // 백엔드 응답: { token, member: { id, email, nickname }, success }
                if (!data || !data.token) {
                    throw new Error("소셜 로그인 실패: 토큰이 없습니다.");
                }

                localStorage.setItem("token", data.token);
                console.log("소셜 로그인 토큰 저장 완료:", data.token.substring(0, 20) + "...");

                router.push("/mypage");
            } catch (err) {
                console.error("소셜 로그인 실패:", err);
                setError("소셜 로그인 실패: " + (err.message || "알 수 없는 오류"));
            }
        };

        fetchOAuthToken();
    }, [code, provider, state, router]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError(""); // 에러 초기화
        try {
            const res = await login(email, password);

            console.log("로그인 응답:", res);

            // 백엔드 LoginResponse 구조: { success, id, email, nickname, token }
            // res가 문자열일 수 있으므로 JSON 파싱 시도
            let loginData = res;
            if (typeof res === "string") {
                try {
                    loginData = JSON.parse(res);
                } catch {
                    // JSON 파싱 실패시 문자열이 토큰일 수 있음
                    if (res.length > 50) {
                        loginData = {token: res};
                    } else {
                        throw new Error("로그인 응답 형식이 올바르지 않습니다.");
                    }
                }
            }

            if (!loginData || typeof loginData !== "object") {
                throw new Error("로그인 응답 형식이 올바르지 않습니다.");
            }

            const token = loginData.token;

            if (!token) {
                console.error("로그인: 토큰을 찾을 수 없음, 응답: ", loginData);
                throw new Error("로그인에 실패했습니다 (토큰 없음)");
            }

            // 토큰과 사용자 정보 저장
            localStorage.setItem("token", token);
            console.log("토큰 저장 완료:", token.substring(0, 20) + "...");

            router.push("/mypage");
        } catch (err) {
            console.error("login error:", err);

            let userMessage = err.message || "로그인 실패";

            // 백엔드 에러 메시지에 따른 사용자 친화적 메시지
            if (userMessage.includes("이메일이 일치하지 않습니다")) {
                userMessage = "등록되지 않은 이메일입니다. 회원가입을 진행해주세요.";
            } else if (userMessage.includes("비밀번호가 일치하지 않습니다")) {
                userMessage = "이메일 또는 비밀번호가 올바르지 않습니다.";
            } else if (userMessage.includes("소셜 로그인으로만 사용 가능")) {
                userMessage = "이 계정은 소셜 로그인 계정입니다. 네이버/구글 로그인을 이용하거나 마이페이지에서 비밀번호를 설정하세요.";
            } else if (userMessage.includes("400") || err.status === 400) {
                userMessage = "이메일 또는 비밀번호를 확인해주세요.";
            }

            setError(userMessage);
        }
    };

    const goToSignUp = () => router.push("/signup");

    return (<div
        className="flex items-center justify-center min-h-screen bg-linear-to-br from-green-50 to-blue-50 font-sans px-4">
        <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md text-center border border-gray-200">
            <h1 className="text-4xl font-extrabold mb-4 text-gray-800">
                Crypto Journal
            </h1>
            <p className="text-gray-600 mb-8">
                로그인해서 오늘의 크립토 기록을 시작하세요.
            </p>

            <form className="flex flex-col gap-4" onSubmit={handleLogin}>
                <input
                    type="email"
                    placeholder="이메일"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="p-3 rounded-lg border border-gray-300 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400 transition"
                />
                <input
                    type="password"
                    placeholder="비밀번호"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="p-3 rounded-lg border border-gray-300 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400 transition"
                />
                <button
                    type="submit"
                    className="p-3 bg-stone-600 text-white font-semibold rounded-lg hover:bg-green-700 transition"
                >
                    로그인
                </button>
            </form>

            {error && (<div className="bg-red-50 border border-red-300 rounded-lg p-4 mt-4">
                    <p className="text-red-600 font-medium">{error}</p>
                </div>)}

            <button
                onClick={goToSignUp}
                className="mt-6 p-3 w-full border-2 border-green-600 text-green-600 font-bold rounded-lg hover:bg-green-600 hover:text-white transition shadow-md"
            >
                회원가입하기
            </button>

            <div className="mt-6 flex flex-col gap-3">
                <a
                    href={`https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI,)}&response_type=code&scope=profile email`}
                    className="hover:shadow-lg transition"
                >
                    <img
                        src="/web_light_rd_ctn@2x.png"
                        alt="구글 로그인"
                        className="w-full h-12 object-contain"
                    />
                </a>

                <a
                    href={`https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${process.env.NEXT_PUBLIC_NAVER_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_NAVER_REDIRECT_URI,)}&state=${Math.random().toString(36).substring(2)}`}
                    className="hover:shadow-lg transition"
                >
                    <img
                        src="/NAVER_login_Dark_KR_green_center_H48.png"
                        alt="네이버 로그인"
                        className="w-full h-12 object-contain"
                    />
                </a>
            </div>

        </div>
    </div>);
}
