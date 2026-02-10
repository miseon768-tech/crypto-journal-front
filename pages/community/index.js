import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getPosts } from "../../api/post";
import { useToken } from "../../stores/account-store";

export default function CommunityIndex() {
    const router = useRouter();
    const { token: globalToken, setToken } = useToken();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        let token = globalToken || localStorage.getItem("token");
        if (!token) {
            setMessage("로그인이 필요합니다.");
            setLoading(false);
            return;
        }

        setToken(token); // 전역 상태에도 동기화

        let alive = true;

        const fetchPosts = async () => {
            setLoading(true);
            try {
                const data = await getPosts(token);
                if (!alive) return;
                const postsArray = Array.isArray(data) ? data : [];
                setPosts(postsArray);
                setMessage(postsArray.length === 0 ? "작성된 글이 없습니다." : null);
            } catch (err) {
                if (!alive) return;
                console.error(err);
                if (String(err).includes("403") || String(err).includes("401")) {
                    setMessage("권한이 없습니다. 로그인 후 다시 시도해주세요.");
                    localStorage.removeItem("token");
                    setToken(null);
                } else {
                    setMessage("글 불러오기 실패 혹은 네트워크 오류");
                }
                setPosts([]);
            } finally {
                if (!alive) return;
                setLoading(false);
            }
        };

        fetchPosts();
        return () => { alive = false; };
    }, [globalToken, setToken]);

    return (
        <div className="min-h-screen p-10 bg-gray-900 text-white">
            <div className="max-w-3xl mx-auto space-y-4">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold">커뮤니티</h1>
                    <button
                        onClick={() => router.push("/community/write")}
                        className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg"
                    >
                        글 작성
                    </button>
                </div>

                {loading && <p>로딩 중...</p>}
                {!loading && message && <p>{message}</p>}

                {!loading && posts.map((post) => (
                    <div
                        key={post.id}
                        onClick={() => router.push(`/community/${post.id}`)}
                        className="cursor-pointer bg-white/10 p-4 rounded-lg hover:bg-white/20 transition"
                    >
                        <div className="flex justify-between mb-2">
                            <span>{post.authorNickname || "익명"}</span>
                            <span className="text-gray-400 text-sm">
                {new Date(post.createdAt).toLocaleString()}
              </span>
                        </div>
                        <p className="truncate">{post.content}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}