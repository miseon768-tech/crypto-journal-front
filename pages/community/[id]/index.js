import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { getPostById } from "../../../api/post";
import { getCommentsByPost, addComment } from "../../../api/comment";
import { useToken } from "../../../stores/account-store";
import { getStoredToken } from "../../../api/_client";

export default function CommunityDetail() {
    const router = useRouter();
    const { id } = router.query;
    const { token: storedToken } = useToken();
    const token = getStoredToken(storedToken);

    const [post, setPost] = useState(null);
    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState("");

    useEffect(() => {
        if (!id) return;
        // 백엔드가 인증을 요구하므로 토큰이 없으면 로그인으로 이동
        if (!token) {
            try { localStorage.removeItem('token'); } catch (e) {}
            try { /* setToken(null) handled by store consumer elsewhere */ } catch (e) {}
            router.push('/login');
            return;
        }

        const fetchData = async () => {
            try {
                const postData = await getPostById(id, token);
                setPost(postData);
                const commentData = await getCommentsByPost(id, token);
                setComments(commentData);
            } catch (err) {
                console.error("상세 불러오기 실패:", err);
                // 인증 실패 처리
                if (err && (err.status === 401 || err.status === 403 || (err.body && err.body.message && err.body.message.includes('토큰')))) {
                    try { localStorage.removeItem('token'); } catch (e) {}
                    try { /* noop */ } catch (e) {}
                    router.push('/login');
                }
            }
        };
        fetchData();
    }, [id, storedToken]);

    const handleAddComment = async () => {
        if (!commentText.trim()) return;
        if (!token) {
            alert('로그인이 필요합니다.');
            router.push('/login');
            return;
        }
        try {
            await addComment({ postId: id, content: commentText }, token);
            const updatedComments = await getCommentsByPost(id, token);
            setComments(updatedComments);
            setCommentText("");
        } catch (err) {
            console.error("댓글 작성 실패:", err);
            alert("댓글 작성 실패");
        }
    };

    if (!post) return <div className="p-10 text-white">로딩 중...</div>;

    return (
        <div className="min-h-screen p-10 bg-gray-900 text-white">
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="bg-white/10 backdrop-blur-lg p-6 rounded-xl">
                    <div className="flex justify-between mb-2">
                        <span className="font-semibold">{post.authorNickname || "익명"}</span>
                        <span className="text-gray-400 text-sm">
                            {new Date(post.createdAt).toLocaleString()}
                        </span>
                    </div>
                    <p className="whitespace-pre-wrap">{post.content}</p>
                </div>

                <div className="space-y-4">
                    <h2 className="text-xl font-bold">댓글</h2>
                    {comments.map((c) => (
                        <div key={c.id} className="bg-white/10 p-3 rounded-lg">
                            <div className="flex justify-between mb-1">
                                <span className="font-semibold">{c.authorNickname || "익명"}</span>
                                <span className="text-gray-400 text-xs">
                                    {new Date(c.createdAt).toLocaleString()}
                                </span>
                            </div>
                            <p>{c.content}</p>
                        </div>
                    ))}
                    <div className="flex space-x-2">
                        <input
                            type="text"
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            className="flex-1 p-2 rounded-lg bg-gray-800 text-white focus:outline-none"
                            placeholder="댓글 작성..."
                        />
                        <button
                            onClick={handleAddComment}
                            className="px-4 py-2 bg-blue-500 rounded-lg hover:bg-blue-600 transition"
                        >
                            작성
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}