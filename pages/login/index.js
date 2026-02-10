import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { login, getMyInfo } from "../api/member";
import { socialLogin } from "../api/social";
import { useAccount, useToken } from "../../stores/account-store";

const CONTAINER = "mx-auto w-full max-w-7xl px-15 ";

export default function Login() {
  const router = useRouter();
  const { code, provider, state } = router.query || {};

  // 이메일/비밀번호로 백엔드 로그인에 맞춤
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [loginErrorMessage, setLoginErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const { setAccount } = useAccount();
  const { setToken } = useToken();

  // 토큰 정규화 함수 (따옴표/공백/'Bearer ' 제거)
  function normalizeTokenString(raw) {
    if (!raw) return raw;
    let t = String(raw).trim();
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      t = t.substring(1, t.length - 1).trim();
    }
    if (t.toLowerCase().startsWith('bearer ')) {
      t = t.substring(7).trim();
    }
    return t;
  }

  // 토큰 저장 후 서버에서 검증해 프로필을 불러오는 헬퍼
  async function persistTokenAndFetchProfile(rawToken) {
    const norm = normalizeTokenString(rawToken);
    try { localStorage.setItem('token', norm); } catch (e) { console.warn('localStorage set failed', e); }
    try { setToken(norm); } catch (e) { console.warn('setToken error', e); }

    const check = await getMyInfo(norm);
    if (check && check.error) {
      // 유효하지 않으면 제거
      try { localStorage.removeItem('token'); } catch (e) {}
      try { setToken(null); } catch (e) {}
      // 에러를 throw하지 않고 결과 객체로 반환
      return { success: false, error: check.error };
    }

    let payload = check && check.data ? check.data : check;
    if (payload && payload.member && typeof payload.member === 'object') payload = payload.member;
    if (payload && payload.data && typeof payload.data === 'object') payload = payload.data;

    try { setAccount(payload || null); } catch (e) { console.warn('setAccount error', e); }
    return { success: true, payload };
  }

  async function submitHandle(evt) {
    evt.preventDefault();
    setLoginError(false);
    setLoading(true);

    try {
      const res = await login(email, password);
      // login util may return { token } or JSON with token/member
      let obj = res;
      if (typeof res === 'string') {
        try {
          obj = JSON.parse(res);
        } catch {
          // treat as raw token
          obj = { token: res };
        }
      }

      const tokenRaw = (obj && (obj.token || obj.accessToken)) || null;
      if (!tokenRaw) {
        setLoginError(true);
        setLoginErrorMessage('로그인 응답에 토큰이 없습니다.');
        setLoading(false);
        return;
      }

      // 토큰 저장 + 서버 검증 + 계정 정보 로드
      try {
        console.log('로그인: 받은 토큰 (raw):', tokenRaw);

        // 만약 로그인 응답에 사용자 정보가 포함되어 있으면(백의 LoginResponse),
        // 바로 토큰 저장 및 계정 정보 세팅 후 페이지 이동 (getMyInfo 검증은 선택적으로 수행)
        const hasMemberInfo = obj && (obj.id || obj.email || obj.nickname || obj.member);
        const norm = normalizeTokenString(tokenRaw);
        try { localStorage.setItem('token', norm); } catch (e) { console.warn('localStorage set failed', e); }
        try { setToken(norm); } catch (e) { console.warn('setToken error', e); }

        if (hasMemberInfo) {
          // 로그인 응답에서 바로 계정 정보 세팅
          const accountFromLogin = obj.member || { id: obj.id, email: obj.email, nickname: obj.nickname };
          try { setAccount(accountFromLogin); } catch (e) { console.warn('setAccount error', e); }
        } else {
          // 필요한 경우 서버에서 추가 프로필을 가져와 검증
          const result = await persistTokenAndFetchProfile(tokenRaw);
          if (!result || !result.success) {
            const errMsg = (result && result.error && result.error.message) || '토큰 검증 실패';
            console.error('persistTokenAndFetchProfile 실패:', result && result.error);
            setLoginError(true);
            setLoginErrorMessage(String(errMsg));
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error('토큰 저장/검증 실패(예외):', err);
        setLoginError(true);
        setLoginErrorMessage(String(err.message || err));
        setLoading(false);
        return;
      }

      setLoginError(false);
      router.push('/mypage');
    } catch (err) {
      console.error('로그인 실패', err);
      const msg = (err && (err.message || (err.body && err.body.message))) || JSON.stringify(err);
      setLoginErrorMessage(String(msg));
      setLoginError(true);
    } finally {
      setLoading(false);
    }
  }

  // 소셜 로그인 콜백 처리
  useEffect(() => {
    if (!code || !provider) return;

    const handleSocialCallback = async () => {
      try {
        const redirectUri = provider === 'google' ? process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI : process.env.NEXT_PUBLIC_NAVER_REDIRECT_URI;
        const data = await socialLogin({ provider, code, state, redirectUri });
        console.log('소셜 로그인 응답:', data);
        const tokenRaw = (data && (data.token || data.accessToken)) || null;
        if (!tokenRaw) {
          console.error('소셜 로그인: 토큰 없음', data);
          setLoginErrorMessage((data && (data.message || JSON.stringify(data))) || '소셜 로그인 실패: 토큰 없음');
          setLoginError(true);
          return;
        }

        // 토큰 저장 + 서버 검증 + 계정 정보 로드 (일관성 유지)
        try {
          console.log('소셜 로그인: 받은 토큰 (raw):', tokenRaw);
          const norm = normalizeTokenString(tokenRaw);
          try { localStorage.setItem('token', norm); } catch (e) { console.warn('localStorage set failed', e); }
          try { setToken(norm); } catch (e) { console.warn('setToken error', e); }

          // socialLogin 응답에 member 정보가 있으면 바로 세팅
          const accountFromSocial = data.member || (data.id || data.email ? { id: data.id, email: data.email, nickname: data.nickname } : null);
          if (accountFromSocial) {
            try { setAccount(accountFromSocial); } catch (e) { console.warn('setAccount error', e); }
          } else {
            const result = await persistTokenAndFetchProfile(tokenRaw);
            if (!result || !result.success) {
              const errMsg = (result && result.error && result.error.message) || '토큰 검증 실패';
              console.error('persistTokenAndFetchProfile 실패(소셜):', result && result.error);
              setLoginError(true);
              setLoginErrorMessage(String(errMsg));
              return;
            }
          }
        } catch (err) {
          console.error('소셜 토큰 저장/검증 실패(예외)', err);
          setLoginError(true);
          setLoginErrorMessage(String(err.message || err));
          return;
        }

        router.push('/mypage');
      } catch (err) {
        console.error('소셜 로그인 처리 실패', err);
        const msg = (err && (err.message || (err.body && err.body.message))) || JSON.stringify(err);
        setLoginErrorMessage(String(msg));
        setLoginError(true);
      }
    };

    handleSocialCallback();
  }, [code, provider, state]);

  return (
    <div className="h-screen relative bg-white overflow-x-auto overflow-y-hidden">
      {/* 배경: 왼쪽 1/2 그라데이션 + 오른쪽 1/2 흰색 */}
      <div className="absolute inset-0 flex min-w-300">
        <div className="w-1/2 bg-linear-to-r from-sky-50 via-lime-50 to-white" />
        <div className="w-1/2 bg-white" />
      </div>

      {/*  컨텐츠는 가운데로 */}
      <div className="relative">
        <div className={`${CONTAINER} min-w-300`}>
          <div className="min-h-screen flex items-center">
            <div className="w-full flex min-h-160">

              {/* 오른쪽: 폼 */}
              <div className="w-1/2 flex items-center justify-center">
                <div className="w-full max-w-sm">
                  {/* 타이틀 */}
                  <div className="mb-10">
                    <h2 className="text-xl font-bold text-gray-900">로그인</h2>
                    <p className="mt-2 text-xs text-gray-500">이메일과 비밀번호를 입력해주세요.</p>
                  </div>

                  {/* 폼 */}
                  <form className="space-y-8" onSubmit={submitHandle}>
                    {/* 이메일 */}
                    <div>
                      <label className="block text-xs text-gray-600 mb-2">이메일</label>
                      <input
                        type="email"
                        placeholder="이메일을 입력하세요"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full border-b border-gray-200 bg-transparent pb-3 text-sm outline-none focus:border-neutral-500 placeholder:text-gray-300"
                        required
                      />
                    </div>

                    {/* 비밀번호 */}
                    <div>
                      <label className="block text-xs text-gray-600 mb-2">비밀번호</label>
                      <input
                        type="password"
                        placeholder="비밀번호를 입력하세요"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full border-b border-gray-200 bg-transparent pb-3 text-sm outline-none focus:border-neutral-500 placeholder:text-gray-300"
                        required
                      />
                    </div>

                    {loginError && (
                      <div className="text-xs text-red-500">
                        <p>{loginErrorMessage || '이메일 또는 비밀번호가 올바르지 않습니다.'}</p>
                      </div>
                    )}

                    {/* 버튼 */}
                    <button
                      type="submit"
                      className="w-full bg-slate-800/95 py-3 text-sm font-semibold text-white hover:bg-slate-900 active:scale-[0.99] cursor-pointer"
                      disabled={loading}
                    >
                      {loading ? '로그인 중...' : '로그인'}
                    </button>
                  </form>

                  <div className="mt-4 text-center">
                    <a href="/signup" className="text-sm text-gray-600 underline">회원가입하기</a>
                  </div>

                  {/* 소셜 로그인 버튼 */}
                  <div className="mt-6 flex flex-col gap-3">
                    {
                      // redirect_uri에 provider 쿼리를 붙여서 콜백에서 provider를 알 수 있게 함
                    }
                    <a
                      href={`https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI + '?provider=google')}&response_type=code&scope=profile%20email&access_type=online`}
                      className="hover:shadow-lg transition"
                    >
                      <img src="/web_light_rd_ctn@2x.png" alt="구글 로그인" className="w-full h-12 object-contain" />
                    </a>

                    <a
                      href={`https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${process.env.NEXT_PUBLIC_NAVER_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_NAVER_REDIRECT_URI + '?provider=naver')}&state=${Math.random().toString(36).substring(2)}`}
                      className="hover:shadow-lg transition"
                    >
                      <img src="/NAVER_login_Dark_KR_green_center_H48.png" alt="네이버 로그인" className="w-full h-12 object-contain" />
                    </a>
                  </div>

                  <p className="mt-8 text-center text-xs text-gray-400">문제가 있으면 관리자에게 문의하세요.</p>
                </div>
              </div>
            </div>

            {/*  Freepik 출처 (오른쪽 아래) */}
            <div className="absolute bottom-4 left-4">
              <div className="px-3 py-1 text-[9px] text-neutral-200">
                Background image by{' '}
                <a href="https://www.freepik.com" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-neutral-400/50">
                  Freepik
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
