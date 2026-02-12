import { useEffect, useState } from "react";
import {
    getPosts,
    getPostById,
    getMyPosts,
    createPost,
    deletePost,
    searchPosts,
    likePost,
    unlikePost,
    getMyLikedPosts,
    saveDraft,
    getDrafts,
    updatePost,
    getPostLikeCount,
} from "../api/post";

import {
    addComment,
    updateComment,
    deleteComment,
    getCommentsByPost,
    getCommentsByUser,
} from "../api/comment";

import { useToken } from "../stores/account-store";
import { getStoredToken } from "../api/member";

export default function Community() {
    const { token: globalToken, setToken } = useToken();

    const [mode, setMode] = useState("list"); // list / write / detail
    const [posts, setPosts] = useState([]);
    const [selectedPost, setSelectedPost] = useState(null);

    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState("");

    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [searchKeyword, setSearchKeyword] = useState("");

    const [loading, setLoading] = useState(true);

    const getToken = () => {
        // 우선 zustand에 저장된 토큰 사용, 없으면 localStorage의 token을 사용
        const raw = globalToken || (typeof window !== "undefined" ? localStorage.getItem("token") : null);
        const normalized = getStoredToken(raw) || null;
        // 디버그 로그 (개발 중 활성화하면 유용)
        // console.debug('[Community] raw token:', raw, 'normalized:', normalized);
        return normalized;
    };

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
    // 게시물 불러오기
    // =======================
    const fetchPosts = async (type = "all", keyword = "") => {
        setLoading(true);
        let token = getToken();
        if (token) setToken(token);

        try {
            let data = [];
            switch (type) {
                case "all": data = await getPosts(token); break;
                case "my": data = await getMyPosts(token); break;
                case "liked": data = await getMyLikedPosts(token); break;
                case "search": data = keyword.trim() ? await searchPosts(keyword, token) : []; break;
                case "draft": data = await getDrafts(token); break;
                default: data = await getPosts(token);
            }

            // 디버그: 요청에 사용된 토큰과 원시 응답 로그
            try {
                console.debug('[Community] fetchPosts debug', { type, usedToken: token, rawResponse: data });
            } catch (e) { /* ignore */ }

            // 응답에서 배열을 찾아 정규화: 직접 배열, posts, data 또는 중첩된 첫번째 배열을 사용
            const findArrayIn = (obj) => {
                if (!obj || typeof obj !== 'object') return null;
                if (Array.isArray(obj)) return obj;
                for (const k of Object.keys(obj)) {
                    try {
                        const v = obj[k];
                        if (Array.isArray(v)) return v;
                        if (v && typeof v === 'object') {
                            const nested = findArrayIn(v);
                            if (nested) return nested;
                        }
                    } catch (e) { /* ignore */ }
                }
                return null;
            };

            let list = [];
            if (Array.isArray(data)) list = data;
            else if (data?.posts && Array.isArray(data.posts)) list = data.posts;
            else if (data?.data && Array.isArray(data.data)) list = data.data;
            else {
                const arr = findArrayIn(data);
                if (arr) list = arr;
                else list = [];
            }

            // 디버그: 빈 리스트인데 응답이 있으면 로그를 남김
            if (list.length === 0 && data && Object.keys(data).length > 0) {
                console.debug('[Community] fetchPosts received non-empty response but no array found', { type, raw: data });
            }

            setPosts(list.map(normalizePost));
        } catch (e) {
            console.error("게시물 불러오기 실패", e);
            // 인증(토큰) 관련 오류라면 토큰을 제거하고 익명으로 다시 시도
            const status = e?.status || (e?.message && e.message.includes('401') ? 401 : (e?.message && e.message.includes('403') ? 403 : null));
            if ((status === 401 || status === 403) && token) {
                console.warn('[Community] 토큰 검증 실패, 익명으로 재시도합니다.');
                try {
                    // 토큰 초기화
                    try { localStorage.removeItem('token'); } catch (err) {}
                    try { setToken(null); } catch (err) {}

                    // 익명 조회 시도
                    const anonData = await getPosts(null);
                    const list = Array.isArray(anonData) ? anonData : anonData?.posts ?? anonData?.data ?? [];
                    setPosts(list.map(normalizePost));
                    setLoading(false);
                    return;
                } catch (e2) {
                    console.error('[Community] 익명 조회도 실패했습니다', e2);
                }
            }

            setPosts([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPosts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // =======================
    // 글 작성 / 수정 / 삭제
    // =======================
    const handleCreate = async () => {
        const token = getToken();
        if (!token) return alert("로그인 필요");
        try {
            await createPost({ title, content }, token);
            setTitle(""); setContent(""); setMode("list");
            fetchPosts();
        } catch (e) { console.error("글 작성 실패", e); alert(e?.message || '글 작성 실패'); }
    };

    const handleDelete = async (postId) => {
        const token = getToken();
        if (!token) return alert("로그인 필요");
        try {
            await deletePost(postId, token);
            setMode("list"); fetchPosts();
        } catch (e) { console.error("글 삭제 실패", e); alert(e?.message || '글 삭제 실패'); }
    };

    // =======================
    // 좋아요 / 취소
    // =======================
    const handleLike = async (postId) => {
        const token = getToken();
        if (!token) return alert("로그인 필요");
        try { await likePost(postId, token); fetchPosts(); }
        catch (e) { console.error("좋아요 실패", e); alert(e?.message || '좋아요 실패'); }
    };

    const handleUnlike = async (postId) => {
        const token = getToken();
        if (!token) return alert("로그인 필요");
        try { await unlikePost(postId, token); fetchPosts(); }
        catch (e) { console.error("좋아요 취소 실패", e); alert(e?.message || '좋아요 취소 실패'); }
    };

    // =======================
    // 상세 글 + 댓글
    // =======================
    const openDetail = async (postId) => {
        const token = getToken();
        if (token) setToken(token);
        try {
            const rawPost = await getPostById(postId, token);
            const post = normalizePost(rawPost);
            if (!post.id) return;

            setSelectedPost(post);

            let rawComments = [];
            try { rawComments = await getCommentsByPost(post.id, token); } catch (err) { console.warn('댓글 조회 실패', err); }
            const list = Array.isArray(rawComments) ? rawComments : rawComments?.comment_list ?? rawComments?.data ?? [];
            setComments(list.map(normalizeComment));

            setMode("detail");
        } catch (e) { console.error("상세 글 불러오기 실패", e); alert(e?.message || '상세 불러오기 실패'); }
    };

    const handleAddComment = async () => {
        if (!commentText.trim() || !selectedPost?.id) return;
        const token = getToken();
        if (!token) return alert('댓글 작성은 로그인 필요');
        try {
            await addComment({ postId: selectedPost.id, content: commentText }, token);
            let rawComments = [];
            try { rawComments = await getCommentsByPost(selectedPost.id, token); } catch (err) { console.warn('댓글 목록 재조회 실패', err); }
            const list = Array.isArray(rawComments) ? rawComments : rawComments?.comment_list ?? rawComments?.data ?? [];
            setComments(list.map(normalizeComment));
            setCommentText("");
        } catch (e) { console.error("댓글 작성 실패", e); alert(e?.message || '댓글 작성 실패'); }
    };

    // =======================
    // 임시저장
    // =======================
    const handleSaveDraft = async () => {
        const token = getToken();
        if (!token) return alert("로그인 필요");
        try { await saveDraft({ title, content }, token); alert("임시저장 완료"); }
        catch (e) { console.error("임시저장 실패", e); alert(e?.message || '임시저장 실패'); }
    };

    if (loading) return <p className="p-6 text-white">로딩중...</p>;

    // =======================
    // LIST 화면
    // =======================
    if (mode === "list") {
        // 개발용: 게시물이 비어있다면 디버그 정보와 재시도 버튼을 보여줌
        if (posts.length === 0 && !loading) {
            const dbgToken = getToken();
            const shortToken = dbgToken ? `${dbgToken.substring(0, 20)}...${dbgToken.substring(dbgToken.length - 10)}` : null;

            const handleRetryClick = () => fetchPosts();
            const handleCopyToken = async () => {
                const t = dbgToken || localStorage.getItem('token') || '';
                try { await navigator.clipboard.writeText(t); alert('토큰을 복사했습니다.'); } catch (e) { console.error('토큰 복사 실패', e); alert('토큰 복사 실패: 콘솔 확인'); }
            };
            const handleLogout = () => { try { localStorage.removeItem('token'); } catch (e) {} try { setToken(null); } catch (e) {} alert('로그아웃 처리했습니다. 로그인 해주세요.'); };

            return (
                <div className="p-6 text-white max-w-3xl mx-auto">
                    <div className="mb-6">
                        <h1 className="text-3xl font-bold">커뮤니티</h1>
                        <p className="text-sm text-gray-300 mt-2">게시물이 없습니다. 네트워크 응답 또는 인증 토큰을 확인하세요.</p>
                    </div>

                    <div className="bg-white/5 p-4 rounded mb-4">
                        <p className="text-sm mb-2">디버그 토큰: <span className="font-mono">{shortToken || '없음'}</span></p>
                        <div className="flex gap-2">
                            <button onClick={handleRetryClick} className="px-4 py-2 bg-blue-600 rounded">재시도</button>
                            <button onClick={handleCopyToken} className="px-4 py-2 bg-gray-600 rounded">토큰 복사</button>
                            <button onClick={handleLogout} className="px-4 py-2 bg-red-600 rounded">로그아웃</button>
                        </div>
                    </div>

                    <div className="mb-4">
                        <p className="text-xs text-gray-400">콘솔 로그를 열고 [Community] fetchPosts debug 로그를 확인하세요.</p>
                        <p className="text-xs text-gray-400">(네트워크 탭에서 /api/post 요청의 Authorization 헤더와 응답 상태를 확인하십시오.)</p>
                    </div>
                </div>
            );
        }

        return (
            <div className="p-6 text-white max-w-3xl mx-auto">
                <div className="flex justify-between mb-4">
                    <h1 className="text-3xl font-bold">커뮤니티</h1>
                    <div className="flex gap-2">
                        <button onClick={() => setMode("write")} className="px-4 py-2 bg-primary rounded">글 작성</button>
                    </div>
                </div>

                <div className="mb-4 flex gap-2">
                    <input
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        placeholder="검색어 입력"
                        className="flex-1 px-3 py-2 rounded bg-gray-800"
                    />
                    <button onClick={() => fetchPosts("search", searchKeyword)} className="px-4 py-2 bg-primary rounded">검색</button>
                </div>

                {posts.map((post) => (
                    <div key={post.id} className="bg-white/10 p-4 rounded mb-3">
                        <div className="flex justify-between cursor-pointer" onClick={() => openDetail(post.id)}>
                            <span>{post.title}</span>
                            <span className="text-sm text-gray-400">{post.createdAt ? new Date(post.createdAt).toLocaleString() : ""}</span>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // =======================
    // WRITE 화면
    // =======================
    if (mode === "write") {
        return (
            <div className="p-6 text-white max-w-3xl mx-auto">
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" className="w-full p-3 rounded bg-gray-800 mb-2"/>
                <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="내용" className="w-full p-3 rounded bg-gray-800 h-40 mb-2"/>
                <div className="flex gap-2">
                    <button onClick={handleCreate} className="px-6 py-2 bg-primary rounded">작성</button>
                    <button onClick={handleSaveDraft} className="px-6 py-2 bg-gray-600 rounded">임시저장</button>
                    <button onClick={() => setMode("list")} className="px-6 py-2 bg-gray-600 rounded">취소</button>
                </div>
            </div>
        );
    }

    // =======================
    // DETAIL 화면
    // =======================
    if (mode === "detail" && selectedPost) {
        return (
            <div className="p-6 text-white max-w-3xl mx-auto">
                <div className="bg-white/10 p-6 rounded-xl mb-4">
                    <h2 className="text-2xl font-bold mb-2">{selectedPost.title}</h2>
                    <p className="whitespace-pre-wrap">{selectedPost.content}</p>
                </div>
                <div className="flex gap-2 mb-4">
                    <button onClick={() => { setTitle(selectedPost.title); setContent(selectedPost.content); setMode("write"); }} className="px-4 py-2 bg-primary rounded">수정</button>
                    <button onClick={() => handleDelete(selectedPost.id)} className="px-4 py-2 bg-red-600 rounded">삭제</button>
                </div>
                <div>
                    <h3 className="text-xl font-bold mb-2">댓글</h3>
                    {comments.map((c) => (
                        <div key={c.id} className="bg-white/10 p-3 rounded mb-2">
                            <p>{c.content}</p>
                        </div>
                    ))}
                    <div className="flex gap-2 mt-2">
                        <input value={commentText} onChange={(e) => setCommentText(e.target.value)} className="flex-1 px-3 py-2 rounded bg-gray-800" placeholder="댓글 작성..."/>
                        <button onClick={handleAddComment} className="px-4 py-2 bg-primary rounded">작성</button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}