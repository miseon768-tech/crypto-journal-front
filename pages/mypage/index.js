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

  if (!info) return <div>Loading...</div>;

  return (
    <div style={{ maxWidth: 600, margin: "auto", padding: 20 }}>
      <h1>마이페이지</h1>
      <p>이메일: {info.email}</p>

      <div>
        <h2>정보 수정</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <button onClick={handleUpdate}>수정</button>
      </div>

      <div>
        <h2>비밀번호 변경</h2>
        <input
          type="password"
          placeholder="현재 비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          type="password"
          placeholder="새 비밀번호"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <button onClick={handleChangePassword}>변경</button>
      </div>
    </div>
  );
}
