import {useState} from 'react';
import {useRouter} from 'next/router';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    try {
      const res = await fetch('http://localhost:8080/api/member/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
      });

      const text = await res.text();
      let data = null;
      try { data = JSON.parse(text); } catch { data = text; }

      if (!res.ok) {
        setMessage(data && data.message ? data.message : '재설정 실패');
        return;
      }

      setMessage('비밀번호가 재설정되었습니다. 로그인 페이지로 이동합니다.');
      setTimeout(() => router.push('/login'), 1500);
    } catch (err) {
      console.error(err);
      setMessage('서버 에러. 콘솔 확인');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white p-6 rounded shadow">
        <h1 className="text-2xl font-bold mb-4">비밀번호 재설정</h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="이메일" className="w-full p-2 border rounded" required />
          <input value={code} onChange={e=>setCode(e.target.value)} placeholder="인증 코드" className="w-full p-2 border rounded" required />
          <input value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="새 비밀번호" type="password" className="w-full p-2 border rounded" required />
          <button className="w-full bg-blue-600 text-white p-2 rounded">재설정</button>
        </form>
        {message && <p className="mt-3 text-sm">{message}</p>}
      </div>
    </div>
  );
}

