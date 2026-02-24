import { useRouter } from "next/router";
import { useEffect } from "react";

export default function GoogleCallback() {
    const router = useRouter();
    const { code, state } = router.query;

    useEffect(() => {
        if (!code) return;

        const origin = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_BASE_URL || '');
        const pathname = typeof window !== "undefined" ? window.location.pathname : '/google/callback';

        let params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : '');
        // 제거할 파라미터: code, scope, error, authuser (가능성 있는 것들)
        params.delete("code");
        params.delete("scope");
        params.delete("error");
        params.delete("authuser");

        const preservedQuery = params.toString();
        const redirectUri = `${origin}${pathname}${preservedQuery ? `?${preservedQuery}` : ''}`;

        console.log('[GoogleCallback] reconstructed redirectUri=', redirectUri);

        router.replace(
            `/login?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state || '')}&provider=google&redirectUri=${encodeURIComponent(redirectUri)}`
        );
    }, [code, state, router]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <p className="text-lg">Google 로그인 처리 중...</p>
        </div>
    );
}