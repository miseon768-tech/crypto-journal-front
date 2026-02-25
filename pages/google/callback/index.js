import { useRouter } from "next/router";
import { useEffect } from "react";

export default function GoogleCallback() {
    const router = useRouter();

    useEffect(() => {
        if (!router.query.code) return;

        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const redirectUri = `${origin}/google/callback`;

        const url = `http://localhost:8080/api/auth/google?code=${encodeURIComponent(router.query.code)}&redirectUri=${encodeURIComponent(redirectUri)}`;
        console.log("API 호출 URL:", url);

        fetch(url)
            .then((response) => response.json())
            .then((json) => {
                // 최신 member 구조 반영
                const token = json.token;
                const member = json.member;

                if (token && member) {
                    localStorage.setItem("token", token);
                    localStorage.setItem("member", JSON.stringify(member));
                    router.push("/dashboard");
                } else {
                    alert("구글 로그인 실패: 서버 응답 불완전");
                }
            })
            .catch((err) => {
                console.error("구글 로그인 에러", err);
                alert("구글 로그인 실패");
            });
    }, [router.query.code]);

    return <div>구글 로그인 처리중...</div>;
}