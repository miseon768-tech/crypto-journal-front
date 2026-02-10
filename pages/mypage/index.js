import {useEffect, useState} from "react";
import {useRouter} from "next/router";
import {getMyInfo, updateMember, changePassword} from "../api/member";
import { useAccount } from "../../stores/account-store";

export default function MyPage() {
    const router = useRouter();
    const { account } = useAccount();
    const [info, setInfo] = useState(null);
    const [email, setEmail] = useState("");
    const [nickname, setNickname] = useState("");
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
    const [error, setError] = useState(null);
    const [hasPassword, setHasPassword] = useState(true);
    const [debugInfo, setDebugInfo] = useState(null); // 추가: 서버 에러 본문 등 디버그 정보

    // ✅ 최초 마운트 때만 실행
    useEffect(() => {
        // 전역 스토어에 계정 정보가 이미 있으면 서버 호출 없이 사용
        if (account) {
            console.log('mypage: 전역 store에서 계정 로드', account);
            setInfo(account);
            setEmail(account.email || "");
            setNickname(account.nickname || "");
            setHasPassword(true);
            return;
        }

        const token = localStorage.getItem("token");

        if (!token) {
            router.push("/login");
            return;
        }

        getMyInfo(token)
            .then((res) => {
                console.log("mypage: getMyInfo 성공", res);

                // 새 반환 형태: { data } 또는 { error }
                if (res && res.error) {
                    console.error('mypage: 서버에서 에러 반환', res.error);
                    setDebugInfo({ status: res.error.status || null, body: res.error.body || res.error.message, tokenSnippet: res.error.tokenSnippet || null });

                    let errMsg = res.error.message || '내 정보 조회 실패';
                    if (String(errMsg).includes('401') || String(errMsg).includes('403') || String(errMsg).includes('토큰')) {
                        errMsg = '토큰이 유효하지 않습니다. 다시 로그인해주세요.';
                    }
                    setError(errMsg);
                    // 토큰 문제라면 자동으로 토큰 제거해 사용자가 재로그인하도록 유도
                    if (res.error.status === 401 || res.error.status === 403) {
                        localStorage.removeItem('token');
                    }
                    return;
                }

                // 실제 데이터는 res.data에 들어감
                let payload = res && res.data ? res.data : res;

                if (!payload) {
                    console.error("mypage: 내 정보 응답이 비어있습니다.", res);
                    setError("내 정보 응답이 비어있습니다. 다시 로그인해주세요.");
                    localStorage.removeItem("token");
                    setTimeout(() => router.push("/login"), 1500);
                    return;
                }

                // 서버가 { member: {...} } 같은 래퍼를 붙여 반환할 수 있음
                if (payload.member && typeof payload.member === "object") {
                    payload = payload.member;
                }

                // 혹은 { data: {...} } 형태 (이중 래핑 안전장치)
                if (payload.data && typeof payload.data === "object") {
                    payload = payload.data;
                }

                if (typeof payload !== "object") {
                    console.error('mypage: payload 형식 이상', payload);
                    setError('내 정보 응답 형식이 올바르지 않습니다.');
                    return;
                }

                setInfo(payload);
                setEmail(payload.email || "");
                setNickname(payload.nickname || "");
                setHasPassword(true);
            })
            .catch((err) => {
                console.error("mypage: 내 정보 조회 실패:", err);
                console.error("mypage: 에러 메시지:", err.message);

                // 서버가 전달한 body가 있으면 표시 (front에서 err.body로 던지도록 개선함)
                const serverBody = err.body || err.response || null;
                console.error("mypage: 서버 응답 body:", serverBody);
                setDebugInfo({ status: err.status || (err.response && err.response.status) || null, body: serverBody });

                let errorMessage = err.message || "로그인이 필요합니다.";

                if (errorMessage.includes("401") ||
                    errorMessage.includes("403") ||
                    errorMessage.includes("토큰")) {
                    errorMessage = "토큰이 유효하지 않습니다. 다시 로그인해주세요.";
                }

                setError(errorMessage);
                // 리다이렉트는 디버그 후 사용자가 직접 진행하도록 변경 (자동 리다이렉트 보류)
                // localStorage.removeItem("token");
                // setTimeout(() => router.push("/login"), 2000);
            });
    }, [router, account]);

    // ✅ 정보 수정
    const handleUpdate = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) return router.push("/login");

            const updated = await updateMember(token, {email, nickname});
            setInfo(updated.member || updated);
            alert("정보 수정 완료");
        } catch (err) {
            console.error("정보 수정 실패:", err);
            alert("정보 수정에 실패했습니다.");
        }
    };

    // ✅ 비밀번호 변경
    const handleChangePassword = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) return router.push("/login");

            await changePassword(token, {
                oldPassword,
                newPassword,
                newPasswordConfirm,
            });

            alert(hasPassword ? "비밀번호 변경 완료" : "비밀번호 설정 완료");

            setOldPassword("");
            setNewPassword("");
            setNewPasswordConfirm("");
            setHasPassword(true);
        } catch (err) {
            console.error("비밀번호 변경 실패:", err);

            if (err.message && err.message.includes("현재 비밀번호")) {
                setHasPassword(false);
                alert("현재 비밀번호가 없습니다. 새로운 비밀번호를 설정해주세요.");
            } else {
                alert("비밀번호 변경 실패: " + (err.message || "오류"));
            }
        }
    };

    // 재시도 및 로그아웃 핸들러 추가
    const handleRetry = async () => {
        setError(null);
        setDebugInfo(null);
        const token = localStorage.getItem("token");
        if (!token) return router.push("/login");
        const res = await getMyInfo(token);
        if (res && res.error) {
            setDebugInfo({ status: res.error.status || null, body: res.error.body || res.error.message, tokenSnippet: res.error.tokenSnippet || null });
            let errMsg = res.error.message || '내 정보 조회 실패';
            if (String(errMsg).includes('401') || String(errMsg).includes('403') || String(errMsg).includes('토큰')) {
                errMsg = '토큰이 유효하지 않습니다. 다시 로그인해주세요.';
            }
            setError(errMsg);
            if (res.error.status === 401 || res.error.status === 403) {
                // 토큰 문제라면 토큰을 지우고 사용자가 로그인하도록 안내
                // 여기서는 자동으로 삭제하지 않고 버튼으로 삭제하도록 함
            }
            return;
        }

        // 성공하면 페이지를 다시 로드하여 정상화
        const payload = res && res.data ? res.data : res;
        if (payload) {
            let p = payload;
            if (p.member && typeof p.member === 'object') p = p.member;
            if (p.data && typeof p.data === 'object') p = p.data;
            setInfo(p);
            setEmail(p.email || "");
            setNickname(p.nickname || "");
            setError(null);
            setDebugInfo(null);
        }
    };

    const handleLogoutAndLogin = () => {
        localStorage.removeItem("token");
        router.push("/login");
    };

    const handleCopyToken = async () => {
        const token = localStorage.getItem("token") || "";
        try {
            await navigator.clipboard.writeText(token);
            alert("토큰을 클립보드에 복사했습니다.");
        } catch (e) {
            console.error('토큰 복사 실패', e);
            alert('토큰 복사에 실패했습니다. 콘솔에서 확인하세요.');
        }
    };

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <p className="text-red-500 text-lg">{error}</p>
                    <p className="text-gray-500 mt-2">로그인 페이지로 이동합니다...</p>
                 </div>
             </div>
         );
     }

    if (!info) {
        return (
            <div className="flex items-center justify-center min-h-screen text-gray-500">
                Loading...
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-10 px-4">
            <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-md p-8 space-y-6">
                <h1 className="text-3xl font-bold text-gray-800 text-center">
                    마이페이지
                </h1>
                <p className="text-gray-600">ID: {info.id}</p>

                {/* 정보 수정 */}
                <div className="space-y-3">
                    <h2 className="text-lg font-semibold text-gray-700">정보 수정</h2>
                    <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="이메일"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 text-gray-800"
                    />
                    <input
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="닉네임"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 text-gray-800"
                    />
                    <button
                        onClick={handleUpdate}
                        className="w-full bg-gray-800 text-white font-semibold py-2 rounded-lg hover:bg-gray-700 transition"
                    >
                        수정
                    </button>
                </div>

                {/* 비밀번호 변경 */}
                <div className="space-y-3">
                    <h2 className="text-lg font-semibold text-gray-700">
                        {hasPassword ? "비밀번호 변경" : "비밀번호 설정"}
                    </h2>

                    {hasPassword && (
                        <input
                            type="password"
                            placeholder="현재 비밀번호"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 text-gray-800"
                        />
                    )}

                    <input
                        type="password"
                        placeholder={hasPassword ? "새 비밀번호" : "비밀번호"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 text-gray-800"
                    />

                    <input
                        type="password"
                        placeholder={hasPassword ? "새 비밀번호 확인" : "비밀번호 확인"}
                        value={newPasswordConfirm}
                        onChange={(e) => setNewPasswordConfirm(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 text-gray-800"
                    />

                    <button
                        onClick={handleChangePassword}
                        className="w-full bg-gray-800 text-white font-semibold py-2 rounded-lg hover:bg-gray-700 transition"
                    >
                        {hasPassword ? "변경" : "설정"}
                    </button>
                </div>
            </div>
        </div>
    );
}