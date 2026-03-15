import { useEffect, useRef, useState } from "react";
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
    likeComment,
    unlikeComment,
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

    // comment like UI state (backend doesn't provide whether current user liked each comment)
    const [likedCommentIds, setLikedCommentIds] = useState(() => new Set());

    // comment edit/delete UI state
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editingCommentText, setEditingCommentText] = useState("");

    // Blind-style menus
    const [postMenuOpen, setPostMenuOpen] = useState(false);
    const [commentMenuOpenId, setCommentMenuOpenId] = useState(null);
    const postMenuRef = useRef(null);
    // NOTE: comment menus are rendered in a list; a single ref would only point to the last item.
    // We'll rely on data attributes for outside-click detection instead.

    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [searchKeyword, setSearchKeyword] = useState("");

    const [loading, setLoading] = useState(true);

    // new flag for edit mode (so "write" UI can represent create vs update)
    const [isEditing, setIsEditing] = useState(false);

    // debug panel toggle (hide debug info by default)
    const [showDebug, setShowDebug] = useState(false);

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
            authorId: p.authorId ?? p.author_id ?? p.memberId ?? p.member_id ?? p.member?.id ?? null,
            authorNickname: p.authorNickname ?? p.author_nickname ?? p.memberNickname ?? p.member_nickname ?? p.member?.nickname ?? null,
            viewCount: p.viewCount ?? p.view_count ?? null,
            likeCount: p.likeCount ?? p.like_count ?? p.likes ?? p.likeCnt ?? null,
            commentCount: p.commentCount ?? p.comment_count ?? p.comments ?? p.commentCnt ?? null,
        };
    };

    const formatKoreanDateTime = (value) => {
        if (!value) return "";
        const d = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(d.getTime())) return "";
        return d.toLocaleString('ko-KR');
    };

    const formatRelativeDays = (value) => {
        // Blind 스타일처럼: "작성일 2일" 정도로 간단히
        if (!value) return "";
        const d = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(d.getTime())) return "";
        const diffMs = Date.now() - d.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) return "오늘";
        return `${diffDays}일`;
    };

    const normalizeComment = (raw) => {
        // 서버 응답은 comment_list: [ {id, postId, content, authorId, authorNickname, createdAt} ]
        // 또는 update 응답은 { comment: {...}, success } 형태일 수 있어 둘 다 흡수
        const c = raw?.comment || raw || {};
        return {
            id: c.id ?? c.commentId ?? c._id ?? null,
            content: c.content ?? c.body ?? "",
            createdAt: c.createdAt ?? c.created_at ?? null,
            authorId: c.authorId ?? c.author_id ?? null,
            authorNickname: c.authorNickname ?? c.author_nickname ?? null,
            likeCount: c.likeCount ?? c.like_count ?? c.likes ?? c.likeCnt ?? null,
            replyCount: c.replyCount ?? c.reply_count ?? c.replies ?? c.replyCnt ?? null,
        };
    };

    const extractCommentsArray = (rawComments) => {
        if (Array.isArray(rawComments)) return rawComments;
        if (rawComments?.comment_list && Array.isArray(rawComments.comment_list)) return rawComments.comment_list;
        if (rawComments?.data && Array.isArray(rawComments.data)) return rawComments.data;
        // fallback: find first array
        const seen = new Set();
        const findArrayIn = (obj) => {
            if (!obj || typeof obj !== 'object') return null;
            if (seen.has(obj)) return null;
            seen.add(obj);
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
        return findArrayIn(rawComments) || [];
    };

    const refetchComments = async (postId, token) => {
        if (!postId) return;
        let rawComments = [];
        try {
            rawComments = await getCommentsByPost(postId, token);
        } catch (err) {
            console.warn('댓글 목록 재조회 실패', err);
            rawComments = [];
        }
        const list = extractCommentsArray(rawComments);
        setComments(list.map(normalizeComment));
        // NOTE: 서버에서 내가 좋아요한 댓글 목록/플래그를 내려주지 않아
        // likedCommentIds는 사용자 상호작용 기준으로만 유지합니다.
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

    // close menus on outside click / ESC
    useEffect(() => {
        const onDocClick = (e) => {
            const t = e.target;
            if (postMenuOpen && postMenuRef.current && !postMenuRef.current.contains(t)) {
                setPostMenuOpen(false);
            }
            if (commentMenuOpenId) {
                // If click is outside any comment-menu container, close it.
                // Using closest() avoids per-item refs and works for the first item too.
                const insideAnyMenu = t && typeof t.closest === 'function' && t.closest('[data-comment-menu="true"]');
                if (!insideAnyMenu) setCommentMenuOpenId(null);
            }
        };
        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                setPostMenuOpen(false);
                setCommentMenuOpenId(null);
            }
        };
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [postMenuOpen, commentMenuOpenId]);

    // =======================
    // 글 작성 / 수정 / 삭제
    // =======================

    // Unified submit handler: create when not editing, update when editing
    const handleSubmit = async () => {
        const token = getToken();
        if (!token) return alert("로그인 필요");

        // basic validation
        if (!title.trim() || !content.trim()) return alert("제목과 내용을 입력하세요.");

        try {
            if (isEditing && selectedPost?.id) {
                // NOTE: adjust the argument order to match your API:
                // common patterns:
                //  - updatePost(postId, data, token)
                //  - updatePost({ title, content }, postId, token)
                // If your updatePost has a different signature, change the call accordingly.
                try {
                    await updatePost(selectedPost.id, { title, content }, token);
                } catch (tryAlt) {
                    // fallback attempt with alternative arg order
                    await updatePost({ title, content }, selectedPost.id, token);
                }
            } else {
                await createPost({ title, content }, token);
            }

            // reset state after success
            setTitle("");
            setContent("");
            setIsEditing(false);
            setSelectedPost(null);
            setMode("list");
            fetchPosts();
        } catch (e) {
            console.error(isEditing ? "글 수정 실패" : "글 작성 실패", e);
            alert(e?.message || (isEditing ? '글 수정 실패' : '글 작성 실패'));
        }
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

            // reset menus
            setPostMenuOpen(false);
            setCommentMenuOpenId(null);

            // reset comment like UI state per post (optional: keep global if you want)
            setLikedCommentIds(new Set());

            // reset comment edit state when opening a post
            setEditingCommentId(null);
            setEditingCommentText("");
            await refetchComments(post.id, token);

            setMode("detail");
        } catch (e) { console.error("상세 글 불러오기 실패", e); alert(e?.message || '상세 불러오기 실패'); }
    };

    const toggleCommentLike = async (commentId) => {
        const token = getToken();
        if (!token) return alert('댓글 좋아요는 로그인 필요');
        if (!commentId) return;

        const wasLiked = likedCommentIds.has(commentId);

        // optimistic UI update
        setLikedCommentIds((prev) => {
            const next = new Set(prev);
            if (wasLiked) next.delete(commentId);
            else next.add(commentId);
            return next;
        });

        // optimistic count update (if likeCount exists)
        setComments((prev) => prev.map((c) => {
            if (c.id !== commentId) return c;
            const current = typeof c.likeCount === 'number' ? c.likeCount : 0;
            return { ...c, likeCount: Math.max(0, wasLiked ? current - 1 : current + 1) };
        }));

        try {
            if (wasLiked) await unlikeComment(commentId, token);
            else await likeComment(commentId, token);
        } catch (e) {
            console.error('댓글 좋아요 토글 실패', e);
            // rollback
            setLikedCommentIds((prev) => {
                const next = new Set(prev);
                if (wasLiked) next.add(commentId);
                else next.delete(commentId);
                return next;
            });
            setComments((prev) => prev.map((c) => {
                if (c.id !== commentId) return c;
                const current = typeof c.likeCount === 'number' ? c.likeCount : 0;
                return { ...c, likeCount: Math.max(0, wasLiked ? current + 1 : current - 1) };
            }));
            alert(e?.message || '댓글 좋아요 처리 실패');
        }
    };

    const handleAddComment = async () => {
        if (!commentText.trim() || !selectedPost?.id) return;
        const token = getToken();
        if (!token) return alert('댓글 작성은 로그인 필요');
        try {
            await addComment({ postId: selectedPost.id, content: commentText }, token);
            await refetchComments(selectedPost.id, token);
            setCommentText("");
        } catch (e) { console.error("댓글 작성 실패", e); alert(e?.message || '댓글 작성 실패'); }
    };

    const handleStartEditComment = (comment) => {
        if (!comment?.id) return;
        setEditingCommentId(comment.id);
        setEditingCommentText(comment.content || "");
    };

    const handleCancelEditComment = () => {
        setEditingCommentId(null);
        setEditingCommentText("");
        setCommentMenuOpenId(null);
    };

    const handleUpdateComment = async () => {
        if (!selectedPost?.id) return;
        if (!editingCommentId) return;
        if (!editingCommentText.trim()) return alert('댓글 내용을 입력하세요.');
        const token = getToken();
        if (!token) return alert('댓글 수정은 로그인 필요');
        try {
            await updateComment(editingCommentId, editingCommentText, token);
            await refetchComments(selectedPost.id, token);
            handleCancelEditComment();
        } catch (e) {
            console.error('댓글 수정 실패', e);
            alert(e?.message || '댓글 수정 실패');
        }
    };

    const handleDeleteComment = async (commentId) => {
        if (!selectedPost?.id) return;
        if (!commentId) return;
        const token = getToken();
        if (!token) return alert('댓글 삭제는 로그인 필요');
        if (!confirm('댓글을 삭제할까요?')) return;
        try {
            await deleteComment(commentId, token);
            await refetchComments(selectedPost.id, token);
            if (editingCommentId === commentId) handleCancelEditComment();
            setCommentMenuOpenId(null);
        } catch (e) {
            console.error('댓글 삭제 실패', e);
            alert(e?.message || '댓글 삭제 실패');
        }
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
        // 개발용: 게시물이 비어있다면 간단한 빈 상태를 보여주고, 필요하면 디버그를 열 수 있게 함
        if (posts.length === 0 && !loading) {
            const dbgToken = getToken();
            const shortToken = dbgToken ? `${dbgToken.substring(0, 20)}...${dbgToken.substring(dbgToken.length - 10)}` : null;

            const handleRetryClick = () => fetchPosts();
            const handleCopyToken = async () => {
                const t = dbgToken || localStorage.getItem('token') || '';
                if (!navigator.clipboard) {
                    alert('브라우저가 클립보드를 지원하지 않습니다.');
                    return;
                }
                try { await navigator.clipboard.writeText(t); alert('토큰을 복사했습니다.'); } catch (e) { console.error('토큰 복사 실패', e); alert('토큰 복사 실패: 콘솔 확인'); }
            };
            const handleLogout = () => { try { localStorage.removeItem('token'); } catch (e) {} try { setToken(null); } catch (e) {} alert('로그아웃 처리했습니다. 로그인 해주세요.'); };

            return (
                <div className="p-0 text-white max-w-3xl mx-auto">
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-white">커뮤니티</h1>
                        <p className="text-sm text-gray-300 mt-2">게시물이 없습니다. 글을 작성해보세요.</p>
                    </div>

                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={() => { setIsEditing(false); setSelectedPost(null); setTitle(''); setContent(''); setMode("write"); }}
                            className="px-3 py-2 bg-white/10 hover:bg-white/15 rounded text-sm ml-auto"
                        >
                            글 작성
                        </button>
                    </div>

                    {showDebug && (
                        <div className="bg-white/5 p-4 rounded mb-4">
                            <p className="text-sm mb-2">디버그 토큰: <span className="font-mono break-words">{shortToken || '없음'}</span></p>
                            <div className="flex gap-2">
                                <button onClick={handleRetryClick} className="px-4 py-2 bg-blue-600 rounded">재시도</button>
                                <button onClick={handleCopyToken} className="px-4 py-2 bg-gray-600 rounded">토큰 복사</button>
                                <button onClick={handleLogout} className="px-4 py-2 bg-red-600 rounded">로그아웃</button>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div className="p-0 text-white max-w-3xl mx-auto">
                {/* Blind 스타일 헤더/검색 */}
                <div className="mb-4">
                    <div className="flex gap-2">
                        <input
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                            placeholder="관심있는 내용을 검색해보세요!"
                            className="flex-1 px-3 py-2 rounded bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
                        />
                        <button
                            onClick={() => fetchPosts("search", searchKeyword)}
                            className="px-3 py-2 bg-white/10 hover:bg-white/15 rounded text-sm"
                        >
                            검색
                        </button>
                    </div>
                </div>


                {/* 목록 */}
                <div className="bg-white/5 border border-white/10 rounded-xl overflow-visible">
                    {posts.map((post, idx) => (
                        <div
                            key={post.id || idx}
                            className={`px-4 py-4 ${idx !== 0 ? 'border-t border-white/10' : ''} hover:bg-white/5 cursor-pointer`}
                            onClick={() => openDetail(post.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter') openDetail(post.id); }}
                        >

                            {/* 제목 */}
                            <div className="mt-2 text-base font-semibold text-white leading-snug">
                                {post.title}
                            </div>

                            {/* 메타: 작성자(현재는 닉네임 그대로), 작성일, 조회수 */}
                            <div className="mt-2 text-xs text-gray-300 flex items-center gap-x-2">
                                <span className="min-w-0 truncate">{post.authorNickname ? post.authorNickname : (post.authorId ? `user:${post.authorId}` : '익명')}</span>
                                <span className="opacity-60">·</span>
                                <span>{formatRelativeDays(post.createdAt)}</span>
                                {typeof post.viewCount === 'number' && (
                                    <>
                                        <span className="opacity-60">·</span>
                                        <span>조회수 {post.viewCount}</span>
                                    </>
                                )}
                            </div>

                            {/* 본문 프리뷰 */}
                            <div className="mt-3 text-sm text-gray-200 line-clamp-2">
                                {post.content}
                            </div>

                            {/* 하단 메타 (요청): 👁️ ❤️ 💬 */}
                            <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
                                <span className="inline-flex items-center gap-1">
                                    <span aria-hidden="true">👁️</span>
                                    <span className="tabular-nums">{typeof post.viewCount === 'number' ? post.viewCount : 0}</span>
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <span aria-hidden="true">❤️</span>
                                    <span className="tabular-nums">{typeof post.likeCount === 'number' ? post.likeCount : 0}</span>
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <span aria-hidden="true">💬</span>
                                    <span className="tabular-nums">{typeof post.commentCount === 'number' ? post.commentCount : 0}</span>
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex gap-2 justify-end mt-4">
                    <button
                        onClick={() => { setIsEditing(false); setSelectedPost(null); setTitle(''); setContent(''); setMode("write"); }}
                        className="px-3 py-2 bg-white/10 hover:bg-white/15 rounded text-sm"
                    >
                        글 작성
                    </button>
                </div>
            </div>
        );
    }

    // =======================
    // WRITE 화면
    // =======================
    if (mode === "write") {
        return (
            <div className="p-6 text-white max-w-3xl mx-auto">
                {/* Back 버튼을 왼쪽에 배치 (뒤로 가기) */}
                <div className="mb-4 flex items-center">
                    <button
                        onClick={() => {
                            // 뒤로(목록)로 이동 -- 취소와 동일하게 상태 초기화
                            setMode("list");
                            setIsEditing(false);
                            setSelectedPost(null);
                            setTitle("");
                            setContent("");
                        }}
                        className="px-3 py-1 bg-white/5 rounded transition-colors hover:bg-indigo-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        aria-label="뒤로"
                    >
                        ← 뒤로
                    </button>
                </div>

                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" className="w-full p-3 rounded bg-gray-800 mb-2"/>
                <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="내용" className="w-full p-3 rounded bg-gray-800 h-40 mb-2"/>
                <div className="flex gap-2 justify-end">
                    <button
                        onClick={handleSubmit}
                        className="px-3 py-1 bg-white/5 rounded transition-colors hover:bg-indigo-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        {isEditing ? "수정 완료" : "작성"}
                    </button>
                    <button
                        onClick={handleSaveDraft}
                        className="px-3 py-1 bg-white/5 rounded transition-colors hover:bg-indigo-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        임시저장
                    </button>
                    <button
                        onClick={() => { setMode("list"); setIsEditing(false); setSelectedPost(null); setTitle(''); setContent(''); }}
                        className="px-3 py-1 bg-white/5 rounded transition-colors hover:bg-indigo-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        취소
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
            <div className="p-0 pb-24 text-white max-w-3xl mx-auto">
                {/* Back */}
                <div className="mb-3 flex items-center">
                    <button
                        onClick={() => {
                            setMode("list");
                            setIsEditing(false);
                            setSelectedPost(null);
                            setTitle("");
                            setContent("");
                        }}
                        className="px-3 py-2 bg-white/10 hover:bg-white/15 rounded text-sm"
                        aria-label="뒤로"
                    >
                        ← 뒤로
                    </button>
                </div>

                {/* Post */}
                <div className="px-1">
                    <div className="px-4 py-4">
                        {/* 채널 라인 */}
                        <div className="flex items-center justify-between text-sm mb-3">
                            <button className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/15">팔로우</button>
                        </div>

                        <h2 className="text-xl md:text-2xl font-bold leading-snug text-white">
                            {selectedPost.title}
                        </h2>

                        {/* 작성자 + 메타 (아이디 밑으로, 이모티콘 표기) */}
                        <div className="mt-3 text-sm text-gray-300">
                            <div className="flex items-center">
                                <span className="font-medium">{selectedPost.authorNickname ? selectedPost.authorNickname : '비공개'}</span>
                            </div>
                            <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                                <span className="inline-flex items-center gap-1">
                                    <span aria-hidden="true">🕒</span>
                                    <span>{formatRelativeDays(selectedPost.createdAt) || '어제'}</span>
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <span aria-hidden="true">👁️</span>
                                    <span className="tabular-nums">{typeof selectedPost.viewCount === 'number' ? selectedPost.viewCount : 0}</span>
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <span aria-hidden="true">💬</span>
                                    <span className="tabular-nums">{typeof selectedPost.commentCount === 'number' ? selectedPost.commentCount : comments.length}</span>
                                </span>

                                {/* ⋯ 메뉴를 메타라인(🕒/👁️/💬) 우측 끝으로 이동 */}
                                <div className="ml-auto relative" ref={postMenuRef}>
                                    <button
                                        type="button"
                                        className="px-2 py-1 rounded hover:bg-white/10"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPostMenuOpen((v) => !v);
                                        }}
                                        aria-label="게시글 메뉴"
                                    >
                                        ⋯
                                    </button>
                                    {postMenuOpen && (
                                        <div className="absolute right-0 bottom-full mb-2 w-32 bg-[#0b0f19] border border-white/10 rounded-lg shadow-lg overflow-hidden z-10">
                                            <button
                                                type="button"
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-white/10"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setTitle(selectedPost.title);
                                                    setContent(selectedPost.content);
                                                    setIsEditing(true);
                                                    setPostMenuOpen(false);
                                                    setMode("write");
                                                }}
                                            >
                                                수정
                                            </button>
                                            <button
                                                type="button"
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 text-red-300"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPostMenuOpen(false);
                                                    handleDelete(selectedPost.id);
                                                }}
                                            >
                                                삭제
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* divider */}
                        <div className="mt-4 border-t border-white/10" />

                        <div className="mt-4 text-sm text-gray-200 whitespace-pre-wrap">
                            {selectedPost.content}
                        </div>


                        {/* 액션 */}
                        <div className="mt-5 flex items-center gap-6 text-sm text-gray-300">
                            <button
                                type="button"
                                className="inline-flex items-center gap-2 hover:text-white"
                                onClick={(e) => { e.stopPropagation(); /* TODO: like toggle */ }}
                                aria-label="좋아요"
                            >
                                <span aria-hidden="true">❤️ 좋아요</span>
                            </button>
                            <button
                                type="button"
                                className="inline-flex items-center gap-2 hover:text-white"
                                onClick={(e) => { e.stopPropagation(); }}
                                aria-label="댓글"
                            >
                                <span aria-hidden="true">💬</span>
                                <span className="tabular-nums">{typeof selectedPost.commentCount === 'number' ? selectedPost.commentCount : comments.length}</span>
                            </button>
                            <button type="button" className="hover:text-white">공유하기</button>
                        </div>
                    </div>
                </div>

                {/* Comments */}
                <div className="mt-6 px-1 border-t border-white/10">
                    <div className="px-4 py-3 flex items-center justify-between">
                        <div className="text-base font-semibold">댓글 {comments.length}</div>
                        <div className="text-xs text-gray-400">추천순</div>
                    </div>
                    <div className="px-4 py-4">
                        {/* 댓글 입력 (리스트와 동일한 가로폭: px-5 컨테이너 안에 배치) */}
                        <div className="flex gap-2 mb-4">
                            <input
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                className="flex-1 px-3 py-2 rounded bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
                                placeholder="댓글을 남겨주세요."
                            />
                            <button
                                onClick={handleAddComment}
                                className="px-3 py-2 bg-white/10 hover:bg-white/15 rounded text-sm shrink-0"
                            >
                                작성
                            </button>
                        </div>

                        <div className="mt-2">
                            {comments.map((c) => (
                                <div
                                    key={c.id || `${c.createdAt || ''}-${c.content?.slice(0, 10) || ''}`}
                                    className="py-4 border-b border-white/10"
                                >
                                    {editingCommentId === c.id ? (
                                        <div className="flex flex-col gap-2">
                                            <input
                                                value={editingCommentText}
                                                onChange={(e) => setEditingCommentText(e.target.value)}
                                                className="w-full px-3 py-2 rounded bg-gray-800"
                                                placeholder="댓글 수정..."
                                            />
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    onClick={handleUpdateComment}
                                                    className="px-3 py-1 bg-white/10 rounded hover:bg-white/15"
                                                >
                                                    수정 완료
                                                </button>
                                                <button
                                                    onClick={handleCancelEditComment}
                                                    className="px-3 py-1 bg-white/10 rounded hover:bg-white/15"
                                                >
                                                    취소
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1">
                                                <div className="text-xs text-gray-300 mb-1 flex flex-wrap items-center gap-x-2">
                                                    <span>{c.authorNickname ? c.authorNickname : (c.authorId ? `user:${c.authorId}` : '비공개')}</span>
                                                </div>
                                                <p className="whitespace-pre-wrap">{c.content}</p>

                                                {/* Blind 스타일: 작성일/좋아요/대댓글/메뉴 */}
                                                <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                                                    <span className="inline-flex items-center gap-1">
                                                        <span aria-hidden="true">🕒</span>
                                                        <span>{formatRelativeDays(c.createdAt)}</span>
                                                    </span>
                                                    <span className="inline-flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            className="inline-flex items-center gap-1 hover:text-white"
                                                            onClick={(e) => { e.stopPropagation(); toggleCommentLike(c.id); }}
                                                            aria-label="댓글 좋아요"
                                                        >
                                                            <span aria-hidden="true">{likedCommentIds.has(c.id) ? '❤️' : '🤍'}</span>
                                                            <span className="tabular-nums">{typeof c.likeCount === 'number' ? c.likeCount : 0}</span>
                                                        </button>
                                                    </span>
                                                    <span className="inline-flex items-center gap-1">
                                                        <span aria-hidden="true">💬</span>
                                                        <span className="tabular-nums">{typeof c.replyCount === 'number' ? c.replyCount : 0}</span>
                                                    </span>

                                                    {/* ⋯ 메뉴 */}
                                                    <div className="ml-auto relative" data-comment-menu="true">
                                                        <button
                                                            type="button"
                                                            className="px-2 py-1 rounded hover:bg-white/10"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setCommentMenuOpenId((cur) => (cur === c.id ? null : c.id));
                                                            }}
                                                            aria-label="댓글 메뉴"
                                                        >
                                                            ⋯
                                                        </button>
                                                        {commentMenuOpenId === c.id && (
                                                            <div className="absolute right-0 bottom-full mb-2 w-32 bg-[#0b0f19] border border-white/10 rounded-lg shadow-lg overflow-hidden z-10">
                                                                <button
                                                                    type="button"
                                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-white/10"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleStartEditComment(c);
                                                                    }}
                                                                >
                                                                    수정
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 text-red-300"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteComment(c.id);
                                                                    }}
                                                                >
                                                                    삭제
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>


                    </div>
                </div>
            </div>
        );
    }

    return null;
}