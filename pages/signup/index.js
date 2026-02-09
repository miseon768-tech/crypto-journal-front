import { useState } from "react";
import { useRouter } from "next/router";
import { signUp, sendEmailCode, verifyEmailCode } from "../api/member";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [isVerified, setIsVerified] = useState(false); // 인증 여부
  const [messageColor, setMessageColor] = useState("text-red-500"); // 메시지 색상

  const naverState = Math.random().toString(36).substring(2, 15);

  // 이메일 인증 코드 전송
  const handleSendCode = async () => {
    try {
      await sendEmailCode(email);
      setMessage("인증 코드가 전송되었습니다.");
      setMessageColor("text-blue-600");
      setIsVerified(false);
    } catch (err) {
      setMessage(err.message);
      setMessageColor("text-red-500");
    }
  };

  // 인증 코드 확인
  const handleVerifyCode = async () => {
    try {
      await verifyEmailCode(email, code);
      setIsVerified(true);
      setMessage("이메일 인증이 완료되었습니다.");
      setMessageColor("text-green-600");
    } catch (err) {
      setIsVerified(false);
      setMessage(err.message);
      setMessageColor("text-red-500");
    }
  };

  // 회원가입
  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!isVerified) {
      setMessage("이메일 인증을 먼저 완료해주세요.");
      setMessageColor("text-red-500");
      return;
    }
    try {
      await signUp({ email, name, password, code });
      router.push("/login");
    } catch (err) {
      setMessage(err.message);
      setMessageColor("text-red-500");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans p-4">
      <div className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-md text-center space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">회원가입</h1>
        <p className="text-gray-600">
          이메일과 비밀번호를 입력하고 회원가입하세요.
        </p>

        {/* 이메일 / 인증 코드 */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 transition"
            />
            <button
              type="button"
              onClick={handleSendCode}
              className="px-4 bg-gray-800 text-white rounded-md hover:bg-gray-900 transition"
            >
              전송
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="인증 코드"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className="flex-1 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 transition"
            />
            <button
              type="button"
              onClick={handleVerifyCode}
              className="px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              확인
            </button>
          </div>
        </div>

        {/* 이름 / 비밀번호 */}
        <div className="space-y-3">
          <input
            type="text"
            placeholder="아이디"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 transition"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 transition"
          />
        </div>

        {/* 회원가입 버튼 */}
        <button
          onClick={handleSignUp}
          disabled={!isVerified}
          className={`w-full p-3 text-white rounded-md font-semibold transition ${
            isVerified
              ? "bg-gray-900 hover:bg-black"
              : "bg-gray-400 cursor-not-allowed"
          }`}
        >
          회원가입
        </button>

        {message && <p className={`${messageColor} text-sm`}>{message}</p>}

        {/* 소셜 로그인 */}
        <div className="flex flex-col items-center gap-4 w-full max-w-sm mt-4">
          {/* Google 로그인 */}
          <a
            href={`https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(
              process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI,
            )}&response_type=code&scope=profile email`}
            className="w-full"
          >
            <img
              src="/web_light_rd_ctn@2x.png"
              alt="구글 로그인"
              className="w-full max-h-12 object-contain"
            />
          </a>

          {/* Naver 로그인 */}
          <a
            href={`https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${process.env.NEXT_PUBLIC_NAVER_CLIENT_ID}&redirect_uri=${encodeURIComponent(
              process.env.NEXT_PUBLIC_NAVER_REDIRECT_URI,
            )}&state=${naverState}`}
            className="w-full"
          >
            <img
              src="/NAVER_login_Dark_KR_green_center_H48.png"
              alt="네이버 로그인"
              className="w-full max-h-12 object-contain"
            />
          </a>
        </div>
      </div>
    </div>
  );
}
