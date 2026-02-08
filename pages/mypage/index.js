import { useEffect, useState } from "react";
import { getMyInfo, updateMember, changePassword } from "../api/member";

export default function MyPage() {
  const [info, setInfo] = useState(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  useEffect(() => {
    if (!token) return;
    getMyInfo(token).then((res) => {
      setInfo(res);
      setName(res.name);
    });
  }, [token]);

  const handleUpdate = async () => {
    const updated = await updateMember(token, { name });
    setInfo(updated);
    alert("정보 수정 완료");
  };

  const handleChangePassword = async () => {
    await changePassword(token, { password, newPassword });
    alert("비밀번호 변경 완료");
  };

  if (!info)
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        Loading...
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-md p-8 space-y-6">
        <h1 className="text-3xl font-bold text-gray-800 text-center">
          마이페이지
        </h1>
        <p className="text-gray-600">이메일: {info.email}</p>

        {/* 정보 수정 */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-700">정보 수정</h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
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
          <h2 className="text-lg font-semibold text-gray-700">비밀번호 변경</h2>
          <input
            type="password"
            placeholder="현재 비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 text-gray-800"
          />
          <input
            type="password"
            placeholder="새 비밀번호"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 text-gray-800"
          />
          <button
            onClick={handleChangePassword}
            className="w-full bg-gray-800 text-white font-semibold py-2 rounded-lg hover:bg-gray-700 transition"
          >
            변경
          </button>
        </div>
      </div>
    </div>
  );
}
