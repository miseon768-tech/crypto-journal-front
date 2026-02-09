import {useEffect, useState} from "react";
import {useRouter} from "next/router";
import {getMyInfo, updateMember, changePassword} from "../api/member";

export default function MyPage() {
    const router = useRouter();
    const [info, setInfo] = useState(null);
    const [email, setEmail] = useState("");
    const [nickname, setNickname] = useState("");
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
    const [error, setError] = useState(null);
    const [hasPassword, setHasPassword] = useState(true);

    // ✅ 최초 마운트 때만 실행
    useEffect(() => {
        const token = localStorage.getItem("token");

        if (!token) {
            router.push("/login");
            return;
        }

        getMyInfo(token)
            .then((res) => {
                console.log("mypage: getMyInfo 성공", res);

                // 응답 정규화: 여러 형태의 응답을 처리
                let payload = res;
                if (!payload) {
                    throw new Error("내 정보 응답이 비어있습니다.");
                }

                // 서버가 { member: {...} } 같은 래퍼를 붙여 반환할 수 있음
                if (payload.member && typeof payload.member === "object") {
                    payload = payload.member;
                }

                // 혹은 { data: {...} } 형태
                if (payload.data && typeof payload.data === "object") {
                    payload = payload.data;
                }

                // 이제 반드시 객체여야 하며 이메일 등 필드를 사용
                if (typeof payload !== "object") {
                    throw new Error("내 정보 응답 형식이 올바르지 않습니다.");
                }

                setInfo(payload);
                setEmail(payload.email || "");
                setNickname(payload.nickname || "");
                setHasPassword(true);
            })
            .catch((err) => {
                console.error("mypage: 내 정보 조회 실패:", err);
                console.error("mypage: 에러 메시지:", err.message);

                let errorMessage = err.message || "로그인이 필요합니다.";

                // 토큰 관련 에러 처리
                if (errorMessage.includes("401") ||
                    errorMessage.includes("403") ||
                    errorMessage.includes("토큰")) {
                    errorMessage = "토큰이 유효하지 않습니다. 다시 로그인해주세요.";
                }

                setError(errorMessage);
                localStorage.removeItem("token");
                setTimeout(() => router.push("/login"), 2000);
            });
    }, [router]);

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