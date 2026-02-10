import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getPosts } from "../../api/post";
import { useToken } from "../../stores/account-store";
import { getStoredToken } from "../../api/member";

export default function CommunityIndex() {
    const router = useRouter();
    const { token: globalToken, setToken } = useToken();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState(null);
    const [debugInfo, setDebugInfo] = useState(null);
    const [tokenSnippet, setTokenSnippet] = useState(null);
    const [manualToken, setManualToken] = useState("");

    useEffect(() => {
        // getStoredToken을 사용해 문자열 토큰으로 정규화
        const raw = globalToken || (typeof window !== 'undefined' ? localStorage.getItem("token") : null);
        const token = getStoredToken(raw) || null;
        setTokenSnippet(token ? (token.length > 40 ? token.substring(0, 40) + '...' : token) : null);

        if (!token) {
            setMessage("로그인이 필요합니다.");
            setLoading(false);
            return;
        }

        // 전역 상태와 localStorage 동기화
        try { setToken(token); } catch (e) {}

        let alive = true;

        const fetchPosts = async () => {
            setLoading(true);
            try {
                console.debug('[community] 요청 전 토큰 스니펫:', token ? token.substring(0, 20) + '...' : null);
                const data = await getPosts(token);
                console.debug('[community] 원본 응답:', data);
                if (!alive) return;

                // 서버 응답 정규화: 다양한 래퍼(post_list, data, posts 등)를 처리
                let rawList = [];
                if (Array.isArray(data)) rawList = data;
                else if (data && Array.isArray(data.post_list)) rawList = data.post_list;
                else if (data && Array.isArray(data.posts)) rawList = data.posts;
                else if (data && Array.isArray(data.data)) rawList = data.data;
                else if (data && Array.isArray(data.result)) rawList = data.result;
                else if (data && typeof data === 'object') {
                    // 시도: 첫 번째 배열 프로퍼티
                    for (const k of Object.keys(data)) {
                        if (Array.isArray(data[k])) {
                            rawList = data[k];
                            break;
                        }
                    }
                }

                // 항목 매핑: 서버 필드명을 프론트가 기대하는 필드로 변환
                const postsArray = rawList.map((p) => ({
                    id: p.id || p.postId || p._id || null,
                    title: p.title || p.subject || '',
                    content: p.content || p.body || p.text || '',
                    authorNickname: (p.member && (p.member.nickname || p.member.name)) || p.authorNickname || p.author || p.nickname || '',
                    createdAt: p.created_at || p.createdAt || p.created || p.createdAtStr || null,
                    // 원본 전체 보존(디버깅/상세 페이지 용)
                    __raw: p,
                }));

                setPosts(postsArray);
                setMessage(postsArray.length === 0 ? "작성된 글이 없습니다." : null);
                setDebugInfo({ status: 200, body: null });
            } catch (err) {
                if (!alive) return;

                console.error("글 목록 불러오기 실패:", err);

                // 인증 오류 처리
                let status = err?.status || null;
                let body = err?.body || (err?.message || String(err));

                if (String(err).includes("401") || String(err).includes("403") || status === 401 || status === 403) {
                    setMessage("권한이 없습니다. 로그인 후 다시 시도해주세요.");
                    try { localStorage.removeItem("token"); } catch (e) {}
                    try { setToken(null); } catch (e) {}
                } else {
                    setMessage("글 불러오기 실패 혹은 네트워크 오류");
                }

                setPosts([]);
                setDebugInfo({ status, body });
            } finally {
                if (!alive) return;
                setLoading(false);
            }
        };

        fetchPosts();

        return () => { alive = false; };
    }, [globalToken, setToken]);

    const handleRetry = async (useManual = false) => {
        setLoading(true);
        setMessage(null);
        const raw = useManual ? manualToken : (globalToken || (typeof window !== 'undefined' ? localStorage.getItem("token") : null));
        const token = getStoredToken(raw) || null;
        setTokenSnippet(token ? (token.length > 40 ? token.substring(0, 40) + '...' : token) : null);
        if (!token) {
            setMessage('토큰이 없습니다. 로그인 후 시도하세요.');
            setLoading(false);
            return;
        }
        try {
            const data = await getPosts(token);
            console.debug('[community] 수동 재시도 원본 응답:', data);

            let rawList = [];
            if (Array.isArray(data)) rawList = data;
            else if (data && Array.isArray(data.post_list)) rawList = data.post_list;
            else if (data && Array.isArray(data.posts)) rawList = data.posts;
            else if (data && Array.isArray(data.data)) rawList = data.data;
            else if (data && typeof data === 'object') {
                for (const k of Object.keys(data)) {
                    if (Array.isArray(data[k])) {
                        rawList = data[k];
                        break;
                    }
                }
            }

            const postsArray = rawList.map((p) => ({
                id: p.id || p.postId || p._id || null,
                title: p.title || p.subject || '',
                content: p.content || p.body || p.text || '',
                authorNickname: (p.member && (p.member.nickname || p.member.name)) || p.authorNickname || p.author || p.nickname || '',
                createdAt: p.created_at || p.createdAt || p.created || p.createdAtStr || null,
                __raw: p,
            }));

            setPosts(postsArray);
            setMessage((Array.isArray(data) && data.length === 0) ? '작성된 글이 없습니다.' : null);
            setDebugInfo({ status: 200, body: null });
        } catch (err) {
            console.error('재시도 글 불러오기 실패', err);
            setPosts([]);
            setDebugInfo({ status: err?.status || null, body: err?.body || err?.message || String(err) });
            setMessage('글 불러오기 실패');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen p-10 bg-gray-900 text-white">
            <div className="max-w-3xl mx-auto space-y-4">

                {/* 헤더 */}
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold">커뮤니티</h1>
                    <button
                        onClick={() => router.push("/community/write")}
                        className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg transition"
                    >
                        글 작성
                    </button>
                </div>

                {/* 로딩 / 메시지 */}
                {loading && <p>로딩 중...</p>}
                {!loading && message && <p>{message}</p>}

                {/* 글 목록 */}
                {!loading && posts.map((post) => (
                    <div
                        key={post.id}
                        onClick={() => router.push(`/community/${post.id}`)}
                        className="cursor-pointer bg-white/10 p-4 rounded-lg hover:bg-white/20 transition"
                    >
                        <div className="flex justify-between mb-2">
                            <span>{post.title}</span>
                            <span className="text-gray-400 text-sm">
                                {new Date(post.createdAt).toLocaleString()}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}