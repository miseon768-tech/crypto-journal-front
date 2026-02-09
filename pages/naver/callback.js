import { useRouter } from "next/router";
import { useEffect } from "react";

export default function NaverCallback() {
  const router = useRouter();
  const { code, state } = router.query;

  useEffect(() => {
    if (!code) return;

    // 로그인 페이지로 리다이렉트하면서 code, state, provider 전달
    router.push(`/login?code=${code}&state=${state || ""}&provider=naver`);
  }, [code, state, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-lg">Naver 로그인 처리 중...</p>
    </div>
  );
}

