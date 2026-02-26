import { useState } from "react";
import { useRouter } from "next/router";
import { signUp, sendEmailCode, verifyEmailCode } from "../../api/member";

export default function SignUpPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [nickname, setNickname] = useState("");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    const [message, setMessage] = useState("");
    const [isVerified, setIsVerified] = useState(false);
    const [messageColor, setMessageColor] = useState("text-red-400");

    const [lastError, setLastError] = useState(null);
    const [passwordError, setPasswordError] = useState("");
    const [nicknameError, setNicknameError] = useState("");
    const [emailError, setEmailError] = useState("");

    const PASSWORD_REGEX = /(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,20}/;

    const validatePassword = (pw) => {
        if (!pw) return "비밀번호를 입력해주세요.";
        if (!PASSWORD_REGEX.test(pw))
            return "비밀번호는 대문자/소문자/숫자/특수문자를 포함한 8-20자여야 합니다.";
        return "";
    };

    const validateNickname = (nm) => {
        if (!nm) return "닉네임을 입력해주세요.";
        if (nm.length < 2 || nm.length > 6) return "닉네임은 2~6자여야 합니다.";
        return "";
    };

    const validateEmailAddr = (em) => {
        if (!em) return "이메일을 입력해주세요.";
        const re = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
        if (!re.test(em)) return "유효한 이메일을 입력하세요.";
        return "";
    };

    const onEmailChange = (v) => {
        setEmail(v);
        setEmailError(validateEmailAddr(v));
    };
    const onPasswordChange = (v) => {
        setPassword(v);
        setPasswordError(validatePassword(v));
    };
    const onNicknameChange = (v) => {
        setNickname(v);
        setNicknameError(validateNickname(v));
    };

    const handleSendCode = async () => {
        setLastError(null);
        const emErr = validateEmailAddr(email);
        if (emErr) {
            setEmailError(emErr);
            setMessage(emErr);
            setMessageColor("text-red-400");
            return;
        }
        try {
            await sendEmailCode(email);
            alert("인증 코드가 전송되었습니다.");
            setIsVerified(false);
        } catch (err) {
            alert(err?.message || String(err));
        }
    };

    const handleVerifyCode = async () => {
        try {
            await verifyEmailCode(email, code);
            setIsVerified(true);
            alert("이메일 인증이 완료되었습니다.");
        } catch (err) {
            setIsVerified(false);
            alert(err?.message || String(err));
        }
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        if (!isVerified) {
            setMessage("이메일 인증을 먼저 완료해주세요.");
            setMessageColor("text-red-400");
            return;
        }

        const emErr = validateEmailAddr(email);
        const pwErr = validatePassword(password);
        const nnErr = validateNickname(nickname);

        if (emErr || pwErr || nnErr) {
            setEmailError(emErr);
            setPasswordError(pwErr);
            setNicknameError(nnErr);
            setMessage("입력값을 확인해주세요.");
            setMessageColor("text-red-400");
            return;
        }

        try {
            setLastError(null);
            const res = await signUp({ email, nickname, password, code });
            if (res?.success) {
                setMessage("회원가입 완료! 로그인 페이지로 이동합니다.");
                setMessageColor("text-green-500");
                setTimeout(() => router.push("/login"), 1500);
            } else {
                throw new Error("회원가입 실패: 서버 응답을 확인하세요.");
            }
        } catch (err) {
            const serverMsg = err?.body?.message || err.message || String(err);
            setMessage(serverMsg);
            setMessageColor("text-red-400");
            setLastError(err?.body || err?.cause || err);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-6 bg-gray-900">
            <div className="w-full max-w-md">
                <div className="mb-10 text-center">
                    <h1 className="text-3xl font-bold text-white tracking-wide">Crypto Journal</h1>
                </div>

                <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-8 shadow-2xl">
                    <form onSubmit={handleSignUp} className="space-y-6">
                        <div>
                            <label className="block text-gray-400 mb-2 text-sm">이메일</label>
                            <div className="flex gap-2">
                                <input
                                    type="email"
                                    placeholder="example@email.com"
                                    value={email}
                                    onChange={(e) => onEmailChange(e.target.value)}
                                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={handleSendCode}
                                    className="px-4 bg-black text-white rounded-lg hover:bg-blue-600 transition"
                                >
                                    전송
                                </button>
                            </div>
                            {emailError && <p className="text-xs text-red-400 mt-1">{emailError}</p>}
                        </div>

                        <div>
                            <label className="block text-gray-400 mb-2 text-sm">인증 코드</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="인증 코드"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={handleVerifyCode}
                                    className="px-4 bg-black text-white rounded-lg hover:bg-blue-600 transition"
                                >
                                    확인
                                </button>

                            </div>
                        </div>

                        <div>
                            <label className="block text-gray-400 mb-2 text-sm">닉네임</label>
                            <input
                                type="text"
                                placeholder="닉네임"
                                value={nickname}
                                onChange={(e) => onNicknameChange(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                                required
                            />
                            {nicknameError && <p className="text-xs text-red-400 mt-1">{nicknameError}</p>}
                        </div>

                        <div>
                            <label className="block text-gray-400 mb-2 text-sm">비밀번호</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => onPasswordChange(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                                required
                            />
                            {passwordError && <p className="text-xs text-red-400 mt-1">{passwordError}</p>}
                        </div>

                        <button
                            type="submit"
                            disabled={!isVerified || !!emailError || !!nicknameError || !!passwordError}
                            className={`w-full py-3 rounded-xl text-white font-medium transition ${
                                !isVerified || emailError || nicknameError || passwordError
                                    ? "bg-black cursor-not-allowed"
                                    : "bg-black hover:bg-blue-600 shadow-lg hover:shadow-xl"
                            }`}
                        >
                            회원가입
                        </button>

                        {message && <p className={`${messageColor} text-xs mt-2`}>{message}</p>}
                        {lastError && (
                            <div className="mt-2 text-xs text-left bg-gray-50/5 p-3 rounded border border-white/10">
                <pre className="whitespace-pre-wrap">
                  {typeof lastError === "string" ? lastError : JSON.stringify(lastError, null, 2)}
                </pre>
                            </div>
                        )}

                        <div className="mt-6 flex justify-end text-sm text-gray-400">
                            <span>이미 계정이 있으신가요? </span>
                            <button
                                type="button"
                                onClick={() => router.push("/login")}
                                className="ml-1 text-gray-400 underline hover:text-blue-500 transition-colors duration-200"
                            >
                                로그인
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}