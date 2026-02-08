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
    <div style={{ maxWidth: 400, margin: "auto", padding: 20 }}>
      <h1>회원가입</h1>
      <form onSubmit={handleSignUp}>
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="button" onClick={handleSendCode}>
          인증 코드 전송
        </button>
        <input
          type="text"
          placeholder="인증 코드"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">회원가입</button>
      </form>
      {message && <p style={{ color: "red" }}>{message}</p>}
    </div>
  );
}
