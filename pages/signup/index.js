import {useState} from "react";
import {useRouter} from "next/router";
import {signUp, sendEmailCode, verifyEmailCode} from "../../api/member";

export default function SignUpPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [nickname, setNickname] = useState("");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    const [message, setMessage] = useState("");
    const [isVerified, setIsVerified] = useState(false); // 인증 여부
    const [messageColor, setMessageColor] = useState("text-red-500"); // 메시지 색상

    // validation states
    const [lastError, setLastError] = useState(null);
    const [passwordError, setPasswordError] = useState("");
    const [nicknameError, setNicknameError] = useState("");
    const [emailError, setEmailError] = useState("");

    const naverState = Math.random().toString(36).substring(2, 15);

    // 패턴: 대문자1, 소문자1, 숫자1, 특수문자1, 길이 8-20
    const PASSWORD_REGEX = /(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,20}/;

    function validatePassword(pw) {
        if (!pw) return "비밀번호를 입력해주세요.";
        if (!PASSWORD_REGEX.test(pw)) return "비밀번호는 대문자/소문자/숫자/특수문자를 포함한 8-20자여야 합니다.";
        return "";
    }

    function validateNickname(nm) {
        if (!nm) return "닉네임을 입력해주세요.";
        if (nm.length < 2 || nm.length > 6) return "닉네임은 2~6자여야 합니다.";
        return "";
    }

    function validateEmailAddr(em) {
        if (!em) return "이메일을 입력해주세요.";
        const re = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
        if (!re.test(em)) return "유효한 이메일을 입력하세요.";
        return "";
    }

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

    // 이메일 인증 코드 전송
    const handleSendCode = async () => {
        setLastError(null);
        const emErr = validateEmailAddr(email);
        if (emErr) {
            setEmailError(emErr);
            setMessage(emErr);
            setMessageColor("text-red-500");
            return;
        }

        try {
            await sendEmailCode(email);
            alert("인증 코드가 전송되었습니다.");
            setIsVerified(false);
        } catch (err) {
            console.error('handleSendCode error:', err);
            const msg = (err && (err.message || (err.body && err.body.message))) || String(err);
            alert(msg);
        }
    };

    // 인증 코드 확인
    const handleVerifyCode = async () => {
        try {
            await verifyEmailCode(email, code);
            setIsVerified(true);
            alert("이메일 인증이 완료되었습니다.");
        } catch (err) {
            console.error('verifyCode error:', err);
            setIsVerified(false);
            const msg = (err && (err.message || (err.body && err.body.message))) || String(err);
            alert(msg);
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

        const emErr = validateEmailAddr(email);
        const pwErr = validatePassword(password);
        const nnErr = validateNickname(nickname);
        if (emErr || pwErr || nnErr) {
            setEmailError(emErr);
            setPasswordError(pwErr);
            setNicknameError(nnErr);
            setMessage("입력값을 확인해주세요.");
            setMessageColor("text-red-500");
            return;
        }

        try {
            setLastError(null);
            const res = await signUp({email, nickname, password, code});
            console.log("회원가입 응답:", res);

            if (res && res.success) {
                setMessage("회원가입 완료! 로그인 페이지로 이동합니다.");
                setMessageColor("text-green-600");
                setTimeout(() => router.push("/login"), 1500);
            } else {
                // 서버가 성공 필드를 주지 않는 경우도 있으므로 전체 응답 검사
                throw new Error('회원가입 실패: 서버 응답을 확인하세요.');
            }
        } catch (err) {
            console.error("회원가입 오류:", err);
            // handleResponse에서 만든 에러 구조: message, status, body
            const serverMsg = (err && (err.body && err.body.message)) || err.message || String(err);
            setMessage(serverMsg);
            setMessageColor("text-red-500");
            setLastError(err.body || err.cause || err || serverMsg);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans p-4">
            <div className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-md text-center space-y-6">
                <h1 className="text-3xl font-bold text-gray-900">회원가입</h1>
                <div className="text-right">
                    <a href="/login" className="text-sm text-gray-500 underline">이미 계정이 있으신가요? 로그인</a>
                </div>

                {/* 이메일 / 인증 코드 */}
                <div className="space-y-3">
                    <div className="flex gap-2">
                        <input
                            type="email"
                            placeholder="이메일"
                            value={email}
                            onChange={(e) => onEmailChange(e.target.value)}
                            required
                            className="flex-1 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 transition"
                        />
                        <button type="button" onClick={handleSendCode}
                                className="px-4 bg-gray-800 text-white rounded-md hover:bg-gray-900 transition">전송
                        </button>
                    </div>
                    {emailError && <p className="text-xs text-red-500">{emailError}</p>}

                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="인증 코드"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            required
                            className="flex-1 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 transition"
                        />
                        <button type="button" onClick={handleVerifyCode}
                                className="px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">확인
                        </button>
                    </div>
                </div>

                {/* 이름 / 비밀번호 */}
                <div className="space-y-3">
                    <input type="text" placeholder="닉네임" value={nickname}
                           onChange={(e) => onNicknameChange(e.target.value)} required
                           className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 transition"/>
                    {nicknameError && <p className="text-xs text-red-500">{nicknameError}</p>}

                    <input type="password" placeholder="비밀번호" value={password}
                           onChange={(e) => onPasswordChange(e.target.value)} required
                           className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 transition"/>
                    {passwordError && <p className="text-xs text-red-500">{passwordError}</p>}
                </div>

                {/* 회원가입 버튼 */}
                <button onClick={handleSignUp}
                        disabled={!isVerified || !!passwordError || !!nicknameError || !!emailError}
                        className={`w-full p-3 text-white rounded-md font-semibold transition ${!isVerified || passwordError || nicknameError || emailError ? "bg-gray-400 cursor-not-allowed" : "bg-gray-900 hover:bg-black"}`}>
                    회원가입
                </button>

                {message && <p className={`${messageColor} text-sm`}>{message}</p>}
                {lastError && (<div className="mt-2 text-xs text-left bg-gray-50 p-3 rounded border">
                    <pre
                        className="whitespace-pre-wrap">{typeof lastError === 'string' ? lastError : JSON.stringify(lastError, null, 2)}</pre>
                </div>)}

                {/* 소셜 로그인 */}
                <div className="flex flex-col items-center gap-4 w-full max-w-sm mt-4">
                    <a href={`https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI + '?provider=google')}&response_type=code&scope=profile email`}
                       className="w-full">
                        <img src="/web_light_rd_ctn@2x.png" alt="구글 로그인" className="w-full max-h-12 object-contain"/>
                    </a>
                    <a href={`https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${process.env.NEXT_PUBLIC_NAVER_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_NAVER_REDIRECT_URI + '?provider=naver')}&state=${naverState}`}
                       className="w-full">
                        <img src="/NAVER_login_Dark_KR_green_center_H48.png" alt="네이버 로그인"
                             className="w-full max-h-12 object-contain"/>
                    </a>
                </div>
            </div>
        </div>
    );
}
