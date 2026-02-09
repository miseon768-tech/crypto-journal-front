import { useRouter } from "next/router";
import { useEffect } from "react";

export default function GoogleCallback() {
  const router = useRouter();
  const { code } = router.query;

  useEffect(() => {
    if (!code) return;

    // 로그인 페이지로 리다이렉트하면서 code와 provider 전달
    router.push(`/login?code=${code}&provider=google`);
  }, [code, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-lg">Google 로그인 처리 중...</p>
    </div>
  );
}

