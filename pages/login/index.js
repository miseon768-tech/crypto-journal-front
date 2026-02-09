import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { login } from "../api/member";
import { socialLogin } from "../api/social";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const { code, provider, state } = router.query;

  useEffect(() => {
    if (!code || !provider) return;

    const fetchOAuthToken = async () => {
      try {
        const redirectUri =
          provider === "google"
            ? process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI
            : process.env.NEXT_PUBLIC_NAVER_REDIRECT_URI;

        const data = await socialLogin({ provider, code, state, redirectUri });
        localStorage.setItem("token", data.token);
        router.push("/mypage");
      } catch (err) {
        setError("소셜 로그인 실패");
      }
    };

    fetchOAuthToken();
  }, [code, provider, state, router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await login(email, password);
      localStorage.setItem("token", res.token);
      router.push("/mypage");
    } catch (err) {
      setError(err.message || "로그인 실패");
    }
  };

  const goToSignUp = () => router.push("/signup");

  return (
    <div className="flex items-center justify-center min-h-screen bg-linear-to-br from-green-50 to-blue-50 font-sans px-4">
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

        {error && (
          <p className="text-red-500 mt-4 animate-pulse font-medium">{error}</p>
        )}

        <button
          onClick={goToSignUp}
          className="mt-6 p-3 w-full border border-green-600 text-green-600 font-semibold rounded-lg hover:bg-green-50 transition"
        >
          회원가입
        </button>

        <div className="mt-6 flex flex-col gap-3">
          <a
            href={`https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(
              process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI,
            )}&response_type=code&scope=profile email`}
            className="hover:shadow-lg transition"
          >
            <img
              src="/web_light_rd_ctn@1x.png"
              alt="구글 로그인"
              className="w-full h-12 object-contain"
            />
          </a>

          <a
            href={`https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${process.env.NEXT_PUBLIC_NAVER_CLIENT_ID}&redirect_uri=${encodeURIComponent(
              process.env.NEXT_PUBLIC_NAVER_REDIRECT_URI,
            )}&state=${Math.random().toString(36).substring(2)}`}
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
    </div>
  );
}
