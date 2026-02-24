import { useRouter } from "next/router";
import { useEffect } from "react";

export default function NaverCallback() {
    const router = useRouter();
    const { code, state } = router.query;

    useEffect(() => {
        if (!code) return;

        const origin = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_BASE_URL || '');
        const pathname = typeof window !== 'undefined' ? window.location.pathname : '/naver/callback';

        let params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        params.delete('code');
        params.delete('state');
        params.delete('error');

        const preservedQuery = params.toString();
        const redirectUri = `${origin}${pathname}${preservedQuery ? `?${preservedQuery}` : ''}`;

        console.log('[NaverCallback] reconstructed redirectUri=', redirectUri);

        router.replace(
            `/login?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state || '')}&provider=naver&redirectUri=${encodeURIComponent(redirectUri)}`
        );
    }, [code, state, router]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <p className="text-lg">Naver 로그인 처리 중...</p>
        </div>
    );
}