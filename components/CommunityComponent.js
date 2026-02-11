import { useEffect, useState } from "react";
import {
    getPosts,
    getPostById,
    getMyPosts,
    createPost,
    updatePost,
    deletePost,
    searchPosts,
    likePost,
    unlikePost,
    getMyLikedPosts,
    getPostLikeCount,
    saveDraft,
    getDrafts
} from "../api/post";

import {
    addComment,
    updateComment,
    deleteComment,
    getCommentsByPost,
    getCommentsByUser
} from "../api/comment";

import { useToken } from "../stores/account-store";
import { getStoredToken } from "../api/member";

export default function Community({ setActiveTab }) {
    const { token: globalToken, setToken } = useToken();

    const [mode, setMode] = useState("list");
    const [posts, setPosts] = useState([]);
    const [selectedPost, setSelectedPost] = useState(null);

    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState("");

    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");

    const [loading, setLoading] = useState(true);

    const getToken = () => {
        const raw =
            globalToken ||
            (typeof window !== "undefined"
                ? localStorage.getItem("token")
                : null);
        return getStoredToken(raw) || null;
    };

    // =======================
    // 공통 정규화
    // =======================

    const normalizePost = (raw) => {
        const p = raw?.post || raw?.data || raw || {};
        return {
            id: p.id ?? p.postId ?? p._id ?? null,
            title: p.title ?? p.subject ?? "",
            content: p.content ?? p.body ?? "",
            createdAt: p.createdAt ?? p.created_at ?? null,
        };
    };

    const normalizeComment = (raw) => {
        const c = raw?.comment || raw?.data || raw || {};
        return {
            id: c.id ?? c.commentId ?? c._id ?? null,
            content: c.content ?? c.body ?? "",
            createdAt: c.createdAt ?? c.created_at ?? null,
        };
    };

    // =======================
    // 목록
    // =======================

    const fetchPosts = async () => {
        const token = getToken();
        if (!token) return;

        setToken(token);

        const data = await getPosts(token);

        let list = Array.isArray(data)
            ? data
            : data?.posts ?? data?.data ?? [];

        setPosts(list.map(normalizePost));
        setLoading(false);
    };

    useEffect(() => {
        fetchPosts();
    }, []);

    // =======================
    // 작성
    // =======================

    const handleCreate = async () => {
        const token = getToken();
        if (!token) return alert("로그인 필요");

        await createPost({ title, content }, token);

        setTitle("");
        setContent("");
        setMode("list");
        fetchPosts();
    };

    // =======================
    // 상세
    // =======================

    const openDetail = async (postId) => {
        const token = getToken();
        if (!token) return;

        const rawPost = await getPostById(postId, token);
        const normalizedPost = normalizePost(rawPost);

        if (!normalizedPost.id) {
            console.log("❌ post id 없음", rawPost);
            return;
        }

        setSelectedPost(normalizedPost);

        const rawComments = await getCommentsByPost(
            normalizedPost.id,
            token
        );

        let list = Array.isArray(rawComments)
            ? rawComments
            : rawComments?.comment_list ??
            rawComments?.data ??
            [];

        setComments(list.map(normalizeComment));

        setMode("detail");
    };

    // =======================
    // 댓글 작성
    // =======================

    const handleAddComment = async () => {
        if (!commentText.trim()) return;
        if (!selectedPost?.id) return;

        const token = getToken();

        await addComment(
            { postId: selectedPost.id, content: commentText },
            token
        );

        const rawComments = await getCommentsByPost(
            selectedPost.id,
            token
        );

        let list = Array.isArray(rawComments)
            ? rawComments
            : rawComments?.comment_list ??
            rawComments?.data ??
            [];

        setComments(list.map(normalizeComment));
        setCommentText("");
    };

    // =======================
    // LIST 화면
    // =======================

    if (mode === "list") {
        return (
            <div className="p-6 text-white">
                <div className="max-w-3xl mx-auto">
                    <div className="flex justify-between mb-6">
                        <h1 className="text-3xl font-bold">커뮤니티</h1>
                        <button
                            onClick={() => setMode("write")}
                            className="mt-6 px-6 py-3 rounded-lg bg-primary text-white font-bold transform transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_4px_rgba(59,130,246,0.6)]"
                        >
                            글 작성
                        </button>
                    </div>

                    {loading && <p>로딩중...</p>}

                    {posts.map((post) => (
                        <div
                            key={post.id}
                            onClick={() => openDetail(post.id)}
                            className="cursor-pointer bg-white/10 p-4 rounded mb-3 hover:bg-white/20"
                        >
                            <div className="flex justify-between">
                                <span>{post.title}</span>
                                <span className="text-sm text-gray-400">
                  {post.createdAt
                      ? new Date(post.createdAt).toLocaleString()
                      : ""}
                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // =======================
    // WRITE 화면
    // =======================

    if (mode === "write") {
        return (
            <div className="p-6 text-white">
                <div className="max-w-3xl mx-auto space-y-4">
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="제목"
                        className="w-full p-3 rounded bg-gray-800"
                    />

                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="내용"
                        className="w-full p-3 rounded bg-gray-800 h-40"
                    />

                    <button
                        onClick={handleCreate}
                        className="mt-6 px-6 py-3 rounded-lg bg-primary text-white font-bold transform transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_4px_rgba(99,102,241,0.6)]"
                    >
                        작성
                    </button>
                </div>
            </div>
        );
    }

    // =======================
    // DETAIL 화면
    // =======================

    if (mode === "detail" && selectedPost) {
        return (
            <div className="p-6 text-white">
                <div className="max-w-3xl mx-auto space-y-6">
                    <div className="bg-white/10 p-6 rounded-xl">
                        <h2 className="text-2xl font-bold mb-2">
                            {selectedPost.title}
                        </h2>
                        <p className="whitespace-pre-wrap">
                            {selectedPost.content}
                        </p>
                    </div>

                    <div>
                        <h3 className="text-xl font-bold mb-3">댓글</h3>

                        {comments.map((c) => (
                            <div
                                key={c.id}
                                className="bg-white/10 p-3 rounded mb-2"
                            >
                                <p>{c.content}</p>
                            </div>
                        ))}

                        <div className="flex items-end gap-3 mt-3">
                            <input
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                className="flex-1 h-10 px-3 text-sm rounded-lg bg-gray-800 text-white focus:outline-none"
                                placeholder="댓글 작성..."
                            />
                            <button
                                onClick={handleAddComment}
                                className="px-6 py-3 rounded-lg bg-primary text-white font-bold transform transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_4px_rgba(99,102,241,0.6)]"
                            >
                                작성
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}