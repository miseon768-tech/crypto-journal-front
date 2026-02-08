import { useState } from "react";
import { useRouter } from "next/router";
import { login } from "../api/member";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

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

  const goToSignUp = () => {
    router.push("/signup");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 font-sans">
      <div className="bg-white p-10 rounded-2xl shadow w-full max-w-md text-center border border-gray-200">
        <h1 className="text-3xl font-bold mb-6">Crypto Journal</h1>
        <p className="text-gray-600 mb-8">
          로그인해서 오늘의 기록을 시작하세요!
        </p>

        <form className="flex flex-col gap-4" onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="p-3 rounded-lg border border-gray-300 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="p-3 rounded-lg border border-gray-300 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          <button
            type="submit"
            className="p-3 bg-gray-800 text-white font-semibold rounded-lg hover:bg-gray-900 transition"
          >
            로그인
          </button>
        </form>

        {error && <p className="text-red-500 mt-4">{error}</p>}

        <button
          onClick={goToSignUp}
          className="mt-6 p-3 w-full border border-gray-800 text-gray-800 font-semibold rounded-lg hover:bg-gray-100 transition"
        >
          회원가입
        </button>
      </div>
    </div>
  );
}
