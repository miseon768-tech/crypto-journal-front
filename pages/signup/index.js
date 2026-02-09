import { useState } from "react";
import { useRouter } from "next/router";
import { signUp, sendEmailCode } from "../api/member";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");

  const handleSendCode = async () => {
    try {
      await sendEmailCode(email);
      setMessage("인증 코드가 전송되었습니다.");
    } catch (err) {
      setMessage(err.message);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    try {
      await signUp({ email, name, password, code });
      router.push("/login");
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">회원가입</h1>

        <form className="flex flex-col gap-4" onSubmit={handleSignUp}>
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="p-3 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
          />
          <button
            type="button"
            onClick={handleSendCode}
            className="p-3 bg-gray-800 text-white rounded-md hover:bg-gray-900 transition"
          >
            인증 코드 전송
          </button>
          <input
            type="text"
            placeholder="인증 코드"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            className="p-3 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
          />
          <input
            type="text"
            placeholder="이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="p-3 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="p-3 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
          />
          <button
            type="submit"
            className="p-3 bg-gray-900 text-white rounded-md hover:bg-black transition font-semibold"
          >
            회원가입
          </button>
        </form>

        {message && <p className="text-red-500 mt-4 text-center">{message}</p>}

        {/* 소셜 로그인 */}
        <div className="mt-6 flex flex-col gap-3">
          {/* 구글 */}
          <a
            href={`https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI)}&response_type=code&scope=profile email`}
          >
            <img
              src="/web_light_rd_ctn@1x.png"
              alt="구글 로그인"
              className="w-full h-12 object-contain"
            />
          </a>

          {/* 네이버 */}
          <a
            href={`https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${process.env.NEXT_PUBLIC_NAVER_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_NAVER_REDIRECT_URI)}&state=${Math.random().toString(36).substring(2)}`}
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
