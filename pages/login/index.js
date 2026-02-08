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
    <div className="flex items-center justify-center min-h-screen bg-gray-100 font-sans">
      <div className="bg-white p-10 rounded-xl shadow-lg w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">로그인</h1>
        <form className="flex flex-col" onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="p-3 mb-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="p-3 mb-6 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            type="submit"
            className="p-3 mb-4 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors"
          >
            로그인
          </button>
        </form>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <button
          onClick={goToSignUp}
          className="p-2 w-full bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          회원가입
        </button>
      </div>
    </div>
  );
}
