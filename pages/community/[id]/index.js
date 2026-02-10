import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { getPostById } from "../../../api/post";
import { getCommentsByPost, addComment } from "../../../api/comment";
import { useToken } from "../../../stores/account-store";
import { getStoredToken } from "../../../api/member";

export default function CommunityDetail() {
    const router = useRouter();
    const { id } = router.query;
    const { token: storedToken } = useToken();

    const [post, setPost] = useState(null);
    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState("");
    const [commentSubmitting, setCommentSubmitting] = useState(false);

    // 로컬 매핑 유틸: 서버 응답 형태를 프론트가 기대하는 필드로 정규화
    const normalizePost = (raw) => {
        if (!raw || typeof raw !== 'object') return null;
        const p = raw.post || raw.data || raw || {};
        const item = p && typeof p === 'object' ? p : {};
        return {
            id: item.id || item.postId || item._id || null,
            title: item.title || item.subject || '',
            content: item.content || item.body || item.text || '',
            authorNickname: (item.member && (item.member.nickname || item.member.name)) || item.authorNickname || item.author || item.nickname || '',
            createdAt: item.created_at || item.createdAt || item.created || item.createdAtStr || null,
            __raw: item,
        };
    };

    const normalizeComment = (raw) => {
        if (!raw || typeof raw !== 'object') return null;
        const c = raw.comment || raw.data || raw || {};
        const item = c && typeof c === 'object' ? c : {};
        return {
            id: item.id || item.commentId || item._id || null,
            content: item.content || item.body || '',
            authorNickname: (item.member && (item.member.nickname || item.member.name)) || item.authorNickname || item.author || item.nickname || '',
            createdAt: item.created_at || item.createdAt || item.created || item.createdAtStr || null,
            __raw: item,
        };
    };

    useEffect(() => {
        if (!id) return;

        // 토큰은 storedToken(전역)이나 localStorage에서 정규화하여 가져오기
        const token = getStoredToken(storedToken) || getStoredToken(typeof window !== 'undefined' ? localStorage.getItem('token') : null);

        // 백엔드가 인증을 요구하므로 토큰이 없으면 로그인으로 이동
        if (!token) {
            try { localStorage.removeItem('token'); } catch (e) {}
            router.push('/login');
            return;
        }

        const fetchData = async () => {
            try {
                const rawPost = await getPostById(id, token);
                const normPost = normalizePost(rawPost);
                setPost(normPost);

                const rawComments = await getCommentsByPost(id, token);
                // comments may be array or wrapped
                let list = [];
                if (Array.isArray(rawComments)) list = rawComments;
                else if (rawComments && Array.isArray(rawComments.comment_list)) list = rawComments.comment_list;
                else if (rawComments && Array.isArray(rawComments.data)) list = rawComments.data;
                else if (rawComments && typeof rawComments === 'object') {
                    for (const k of Object.keys(rawComments)) {
                        if (Array.isArray(rawComments[k])) { list = rawComments[k]; break; }
                    }
                }
                const mapped = list.map(c => normalizeComment(c)).filter(Boolean);
                setComments(mapped);
            } catch (err) {
                console.error("상세 불러오기 실패:", err);
                // 인증 실패 처리
                if (err && (err.status === 401 || err.status === 403 || (err.body && typeof err.body === 'string' && err.body.includes('토큰')))) {
                    try { localStorage.removeItem('token'); } catch (e) {}
                    router.push('/login');
                }
            }
        };
        fetchData();
    }, [id, storedToken, router]);

    const handleAddComment = async () => {
        if (!commentText.trim()) return;
        const token = getStoredToken(storedToken) || getStoredToken(typeof window !== 'undefined' ? localStorage.getItem('token') : null);
        if (!token) {
            alert('로그인이 필요합니다.');
            router.push('/login');
            return;
        }
        setCommentSubmitting(true);
        try {
            console.debug('[community/detail] addComment token snippet:', token ? token.substring(0,20)+'...' : null, 'postId:', id, 'content:', commentText);
            await addComment({ postId: id, content: commentText }, token);
            const rawComments = await getCommentsByPost(id, token);
            let list = [];
            if (Array.isArray(rawComments)) list = rawComments;
            else if (rawComments && Array.isArray(rawComments.comment_list)) list = rawComments.comment_list;
            else if (rawComments && Array.isArray(rawComments.data)) list = rawComments.data;
            else if (rawComments && typeof rawComments === 'object') {
                for (const k of Object.keys(rawComments)) {
                    if (Array.isArray(rawComments[k])) { list = rawComments[k]; break; }
                }
            }
            setComments(list.map(c => normalizeComment(c)).filter(Boolean));
            setCommentText("");
        } catch (err) {
            console.error("댓글 작성 실패:", err);
            // 상세한 에러 표시
            let msg = "댓글 작성 실패";
            try {
                if (err?.body && typeof err.body === 'object' && err.body.message) msg = err.body.message;
                else if (err?.message) msg = err.message;
            } catch (e) {}
            alert(msg);
        } finally {
            setCommentSubmitting(false);
        }
    };

    if (!post) return <div className="p-10 text-white">로딩 중...</div>;

    return (
        <div className="min-h-screen p-10 bg-gray-900 text-white">
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="bg-white/10 backdrop-blur-lg p-6 rounded-xl">
                    <div className="flex justify-between mb-2">
                        <span className="font-semibold">{post.title}</span>
                        <span className="text-gray-400 text-sm">
                            {post.authorNickname}
                        </span>
                    </div>
                    <div className="flex justify-between mb-2">
                    <span className="whitespace-pre-wrap">{post.content}</span>
                    <span className="text-gray-400 text-sm">
                            {post.createdAt ? new Date(post.createdAt).toLocaleString() : ''}
                    </span>
                    </div>
                </div>

                <div className="space-y-4">
                    <h2 className="text-xl font-bold">댓글</h2>
                    {comments.map((c) => (
                        <div key={c.id} className="bg-white/10 p-3 rounded-lg">
                            <div className="flex justify-between mb-1">
                                <span className="font-semibold">{c.authorNickname || "익명"}</span>
                                <span className="text-gray-400 text-xs">
                                    {c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}
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
                            disabled={commentSubmitting}
                            className="px-4 py-2 bg-blue-500 rounded-lg hover:bg-blue-600 transition"
                        >
                            {commentSubmitting ? '작성중...' : '작성'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}