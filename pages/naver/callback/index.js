import { useRouter } from "next/router";
import { useEffect } from "react";
import { socialLogin } from "../../../api/social";
import { useAccount, useToken } from "../../../stores/account-store";

export default function NaverCallback() {
    const router = useRouter();
    const { setAccount } = useAccount();
    const { setToken } = useToken();

    useEffect(() => {
        if (!router.query.code) return;

        const doCallback = async () => {
            const code = router.query.code;
            const origin = typeof window !== "undefined" ? window.location.origin : "";
            const redirectUri = `${origin}/naver/callback`;

            try {
                const data = await socialLogin('naver', code, redirectUri);
                const token = data?.token || null;
                const member = data?.member || null;

                if (!token || !member) {
                    console.error('[NaverCallback] 로그인 응답 문제', data);
                    alert('네이버 로그인 실패: 서버 응답이 올바르지 않습니다. 콘솔을 확인하세요.');
                    router.push('/login');
                    return;
                }

                try { localStorage.setItem('token', String(token)); } catch (e) { console.warn('localStorage set failed', e); }
                try { localStorage.setItem('member', JSON.stringify(member)); } catch (e) { /* ignore */ }
                try { setToken(String(token)); } catch (e) { /* ignore */ }
                try { setAccount(member); } catch (e) { /* ignore */ }

                router.push('/dashboard');
            } catch (err) {
                console.error('[NaverCallback] 소셜 로그인 에러', err);
                alert('네이버 로그인 처리 중 오류가 발생했습니다: ' + (err.message || '알 수 없음'));
                router.push('/login');
            }
        };

        doCallback();
    }, [router.query.code]);

    return <div>네이버 로그인 처리중...</div>;
}