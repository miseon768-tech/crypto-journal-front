import { useEffect, useRef, useState, useMemo } from "react";
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
    increaseViewCount,
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


    const [likedPostIds, setLikedPostIds] = useState(() => {
        if (typeof window === 'undefined') return new Set();
        try {
            const raw = localStorage.getItem('community_liked_post_ids');
            const arr = raw ? JSON.parse(raw) : [];
            return new Set(Array.isArray(arr) ? arr : []);
        } catch (e) {
            return new Set();
        }
    });
    const [selectedPostLiked, setSelectedPostLiked] = useState(false);

    const [optimisticLikeCountByPostId, setOptimisticLikeCountByPostId] = useState(() => {
        if (typeof window === 'undefined') return {};
        try {
            const raw = localStorage.getItem('community_optimistic_like_counts');
            const obj = raw ? JSON.parse(raw) : {};
            return obj && typeof obj === 'object' ? obj : {};
        } catch (e) {
            return {};
        }
    });

    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState("");
    const [sortBy, setSortBy] = useState('latest');
    const [showSortMenu, setShowSortMenu] = useState(false);

    const [likedCommentIds, setLikedCommentIds] = useState(() => {
        if (typeof window === 'undefined') return new Set();
        try {
            const raw = localStorage.getItem('community_liked_comment_ids');
            const arr = raw ? JSON.parse(raw) : [];
            return new Set(Array.isArray(arr) ? arr.map((v) => String(v)) : []);
        } catch (e) {
            return new Set();
        }
    });
    const [pendingCommentLikes, setPendingCommentLikes] = useState(() => new Set());

    const isPendingComment = (id) => pendingCommentLikes.has(id) || pendingCommentLikes.has(String(id));
    const isLikedComment = (id) => likedCommentIds.has(id) || likedCommentIds.has(String(id));
    const normalizeId = (id) => String(id);

    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editingCommentText, setEditingCommentText] = useState("");
    const [deleteLoading, setDeleteLoading] = useState({});

    const [postMenuOpen, setPostMenuOpen] = useState(false);
    const [commentMenuOpenId, setCommentMenuOpenId] = useState(null);
    const postMenuRef = useRef(null);

    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [searchKeyword, setSearchKeyword] = useState("");

    const [loading, setLoading] = useState(true);

    const [isEditing, setIsEditing] = useState(false);
    const [showDebug, setShowDebug] = useState(false);

    const getToken = () => {
        const raw = globalToken || (typeof window !== "undefined" ? localStorage.getItem("token") : null);
        const normalized = getStoredToken(raw) || null;
        return normalized;
    };

    const normalizePost = (raw) => {
        const p = raw?.post || raw?.data || raw || {};
        const toNumOrNull = (v) => {
            if (v === null || v === undefined) return null;
            const n = typeof v === 'number' ? v : Number(v);
            return Number.isFinite(n) ? n : null;
        };
        return {
            id: p.id ?? p.postId ?? p._id ?? null,
            title: p.title ?? p.subject ?? "",
            content: p.content ?? p.body ?? "",
            createdAt: p.createdAt ?? p.created_at ?? null,
            authorId: p.authorId ?? p.author_id ?? p.memberId ?? p.member_id ?? p.member?.id ?? null,
            authorNickname: p.authorNickname ?? p.author_nickname ?? p.memberNickname ?? p.member_nickname ?? p.member?.nickname ?? null,
            viewCount: toNumOrNull(p.viewCount ?? p.view_count),
            likeCount: toNumOrNull(p.likeCount ?? p.like_count ?? p.likes ?? p.likeCnt),
            commentCount: toNumOrNull(p.commentCount ?? p.comment_count ?? p.comments ?? p.commentCnt),
        };
    };

    const formatKoreanDateTime = (value) => {
        if (!value) return "";
        const d = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(d.getTime())) return "";
        return d.toLocaleString('ko-KR');
    };

    const formatRelativeDays = (value) => {
        if (!value) return "";
        const d = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(d.getTime())) return "";
        const diffMs = Date.now() - d.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) return "오늘";
        return `${diffDays}일`;
    };

    const normalizeComment = (raw) => {
        const c = raw?.comment || raw || {};
        const rawId = c.id ?? c.commentId ?? c._id ?? null;
        return {
            id: rawId !== null && rawId !== undefined ? normalizeId(rawId) : null,
            content: c.content ?? c.body ?? "",
            createdAt: c.createdAt ?? c.created_at ?? null,
            authorId: c.authorId ?? c.author_id ?? null,
            authorNickname: c.authorNickname ?? c.author_nickname ?? null,
            likeCount: c.likeCount ?? c.like_count ?? c.likes ?? c.likeCnt ?? null,
            likedByMe: (c.isLiked ?? c.likedByMe ?? c.liked_by_me ?? c.liked ?? null) === true,
            replyCount: c.replyCount ?? c.reply_count ?? c.replies ?? c.replyCnt ?? null,
        };
    };

    const extractCommentsArray = (rawComments) => {
        if (Array.isArray(rawComments)) return rawComments;
        if (rawComments?.comment_list && Array.isArray(rawComments.comment_list)) return rawComments.comment_list;
        if (rawComments?.data && Array.isArray(rawComments.data)) return rawComments.data;
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
        const normalized = list.map(normalizeComment);
        setComments(normalized);
        try {
            setSelectedPost(prev => {
                if (!prev || prev.id !== postId) return prev;
                return { ...prev, commentCount: normalized.length };
            });
        } catch (e) {
        }
        try {
            const newlyLiked = new Set(likedCommentIds);
            normalized.forEach((c) => {
                if (c && c.id && c.likedByMe) newlyLiked.add(String(c.id));
            });
            const same = (() => {
                if (newlyLiked.size !== (likedCommentIds ? likedCommentIds.size : 0)) return false;
                for (const v of newlyLiked) if (!likedCommentIds.has(v)) return false;
                return true;
            })();
            if (!same) setLikedCommentIds(newlyLiked);
        } catch (e) {
        }
    };

    const getSortedComments = useMemo(() => {
        const sorter = (a, b) => {
            if (sortBy === 'likes') {
                const la = typeof a.likeCount === 'number' ? a.likeCount : 0;
                const lb = typeof b.likeCount === 'number' ? b.likeCount : 0;
                return lb - la;
            }
            const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return db - da;
        };
        return () => {
            try {
                return [...comments].sort(sorter);
            } catch (e) {
                return comments;
            }
        };
    }, [comments, sortBy]);

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

            try {
                console.debug('[Community] fetchPosts debug', { type, usedToken: token, rawResponse: data });
            } catch (e) {  }

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

            if (list.length === 0 && data && Object.keys(data).length > 0) {
                console.debug('[Community] fetchPosts received non-empty response but no array found', { type, raw: data });
            }

            setPosts(list.map(normalizePost));
        } catch (e) {
            console.error("게시물 불러오기 실패", e);
            const status = e?.status || (e?.message && e.message.includes('401') ? 401 : (e?.message && e.message.includes('403') ? 403 : null));
            if ((status === 401 || status === 403) && token) {
                console.warn('[Community] 토큰 검증 실패, 익명으로 재시도합니다.');
                try {
                    try { localStorage.removeItem('token'); } catch (err) {}
                    try { setToken(null); } catch (err) {}

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
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem('community_liked_post_ids', JSON.stringify(Array.from(likedPostIds)));
        } catch (e) {
        }
    }, [likedPostIds]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem('community_optimistic_like_counts', JSON.stringify(optimisticLikeCountByPostId || {}));
        } catch (e) {
        }
    }, [optimisticLikeCountByPostId]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem('community_liked_comment_ids', JSON.stringify(Array.from(likedCommentIds || [])));
        } catch (e) {
        }
    }, [likedCommentIds]);

    useEffect(() => {
        const onDocClick = (e) => {
            const t = e.target;
            if (postMenuOpen && postMenuRef.current && !postMenuRef.current.contains(t)) {
                setPostMenuOpen(false);
            }
            if (commentMenuOpenId) {
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

    const handleSubmit = async () => {
        const token = getToken();
        if (!token) return alert("로그인 필요");

        if (!title.trim() || !content.trim()) return alert("제목과 내용을 입력하세요.");

        try {
            if (isEditing && selectedPost?.id) {
                await createPost({ title, content }, token, selectedPost.id);
            } else {
                await createPost({ title, content }, token);
            }

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

    const togglePostLike = async (postId) => {
        const token = getToken();
        if (!token) return alert("로그인 필요");
        if (!postId) return;

        const wasLiked = likedPostIds.has(postId);
        const newLiked = !wasLiked;

        setLikedPostIds((prev) => {
            const next = new Set(prev);
            if (newLiked) next.add(postId);
            else next.delete(postId);
            return next;
        });

        setPosts((prev) => prev.map((p) => {
            if (p.id !== postId) return p;
            const current = typeof p.likeCount === 'number' ? p.likeCount : (optimisticLikeCountByPostId[postId] ?? 0);
            const nextCount = Math.max(0, newLiked ? current + 1 : current - 1);
            return { ...p, likeCount: nextCount };
        }));
        setOptimisticLikeCountByPostId((prev) => {
            const current = prev[postId] ?? (posts.find((p) => p.id === postId)?.likeCount ?? 0);
            const base = typeof current === 'number' ? current : 0;
            const nextCount = Math.max(0, newLiked ? base + 1 : base - 1);
            return { ...prev, [postId]: nextCount };
        });

        if (selectedPost?.id === postId) {
            setSelectedPostLiked(newLiked);
            setSelectedPost((prev) => {
                if (!prev || prev.id !== postId) return prev;
                const current = typeof prev.likeCount === 'number' ? prev.likeCount : 0;
                return { ...prev, likeCount: Math.max(0, newLiked ? current + 1 : current - 1) };
            });
        }

        try {
            if (newLiked) {
                await likePost(postId, token);
            } else {
                await unlikePost(postId, token);
            }
        } catch (e) {
            const msg = (e?.message || '').toString();
            const dupLike = newLiked && (msg.includes('이미') || msg.toLowerCase().includes('already'));
            const dupUnlike = !newLiked && (msg.includes('이미') || msg.toLowerCase().includes('already'));

            console.error('글 좋아요 토글 실패', e);

            if (dupLike) {
                setLikedPostIds((prev) => {
                    const next = new Set(prev);
                    next.add(postId);
                    return next;
                });
                setSelectedPostLiked(true);
                return;
            }
            if (dupUnlike) {
                setLikedPostIds((prev) => {
                    const next = new Set(prev);
                    next.delete(postId);
                    return next;
                });
                setSelectedPostLiked(false);
                return;
            }

            setLikedPostIds((prev) => {
                const next = new Set(prev);
                if (wasLiked) next.add(postId);
                else next.delete(postId);
                return next;
            });
            setPosts((prev) => prev.map((p) => {
                if (p.id !== postId) return p;
                const current = typeof p.likeCount === 'number' ? p.likeCount : 0;
                return { ...p, likeCount: Math.max(0, wasLiked ? current + 1 : current - 1) };
            }));
            setOptimisticLikeCountByPostId((prev) => {
                const current = prev[postId] ?? 0;
                const nextCount = Math.max(0, wasLiked ? current + 1 : current - 1);
                return { ...prev, [postId]: nextCount };
            });
            if (selectedPost?.id === postId) {
                setSelectedPostLiked(wasLiked);
                setSelectedPost((prev) => {
                    if (!prev || prev.id !== postId) return prev;
                    const current = typeof prev.likeCount === 'number' ? prev.likeCount : 0;
                    return { ...prev, likeCount: Math.max(0, wasLiked ? current + 1 : current - 1) };
                });
            }
            alert(e?.message || '좋아요 처리 실패');
        }
    };


    const handleCommentLikeFailure = (e, commentId, wasLiked, newLiked) => {
        try {
            console.error('댓글 좋아요 토글 실패', e);
        } catch (err) { /* ignore */ }

        const body = e?.body || null;
        const serverMsg = (body && typeof body === 'object' && (body.message || body.error)) ? (body.message || body.error) : null;
        const textMsg = serverMsg || e?.message || String(e || '댓글 좋아요 처리 실패');

        const msgLower = (textMsg || '').toString().toLowerCase();
        const dupLike = newLiked && (msgLower.includes('이미') || msgLower.includes('already'));
        const dupUnlike = !newLiked && (msgLower.includes('이미') || msgLower.includes('already'));

        const sid = normalizeId(commentId);
        if (dupLike) {
            setLikedCommentIds((prev) => { const next = new Set(prev); next.add(sid); return next; });
        } else if (dupUnlike) {
            setLikedCommentIds((prev) => { const next = new Set(prev); next.delete(sid); return next; });
        } else {
            setLikedCommentIds((prev) => {
                const next = new Set(prev);
                if (wasLiked) next.add(sid);
                else next.delete(sid);
                return next;
            });
            setComments((prev) => prev.map((c) => {
                if (String(c.id) !== String(sid)) return c;
                const current = typeof c.likeCount === 'number' ? c.likeCount : 0;
                return { ...c, likeCount: Math.max(0, wasLiked ? current + 1 : current - 1) };
            }));
        }

        const statusCode = e?.status || (e?.body && e.body?.status) || null;
        if (statusCode && Number(statusCode) >= 500) {
            console.error('[Community] 서버(5xx) 오류 응답', { commentId, status: statusCode, error: e });
            alert('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        } else {
            alert(serverMsg ? `${serverMsg}` : (e?.message || '댓글 좋아요 처리 실패'));
        }
    };

    const openDetail = async (postId) => {
        const token = getToken();
        if (token) setToken(token);
        try {
            try {
                await increaseViewCount(postId, token);
                setPosts((prev) => prev.map((p) => {
                    if (p.id !== postId) return p;
                    const current = typeof p.viewCount === 'number' ? p.viewCount : 0;
                    return { ...p, viewCount: current + 1 };
                }));
            } catch (e) {
                console.warn('조회수 증가 실패(무시하고 진행)', e);
            }

            const rawPost = await getPostById(postId, token);
            const post = normalizePost(rawPost);
            if (!post.id) return;

            setSelectedPost(post);
            setSelectedPostLiked(Boolean(post?.id && likedPostIds.has(post.id)));

            try {
                const optimistic = optimisticLikeCountByPostId[post.id];
                if (typeof optimistic === 'number') {
                    setSelectedPost((prev) => ({ ...prev, likeCount: optimistic }));
                }
            } catch (e) {
            }

            setPostMenuOpen(false);
            setCommentMenuOpenId(null);

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

        const sid = normalizeId(commentId);
        if (isPendingComment(sid)) return;

        const targetComment = comments.find((c) => String(c.id) === String(sid));
        const wasLiked = likedCommentIds.has(sid) || (targetComment && targetComment.likedByMe === true);
        const newLiked = !wasLiked;

        const prevCount = targetComment ? (typeof targetComment.likeCount === 'number' ? targetComment.likeCount : 0) : 0;

        setPendingCommentLikes((prev) => new Set(prev).add(sid));

        setLikedCommentIds((prev) => {
            const next = new Set(prev);
            newLiked ? next.add(sid) : next.delete(sid);
            return next;
        });

        setComments((prev) => prev.map((c) => {
            if (String(c.id) !== String(sid)) return c;
            const current = typeof c.likeCount === 'number' ? c.likeCount : 0;
            return { ...c, likeCount: Math.max(0, newLiked ? current + 1 : current - 1), likedByMe: newLiked };
        }));

        try {
            const call = newLiked ? likeComment(commentId, token) : unlikeComment(commentId, token);
            const resp = await call;

            if (resp && resp.__error) {
                if (resp.status === 400) {
                    if (selectedPost?.id) await refetchComments(selectedPost.id, token);
                    return;
                }
                throw resp;
            }

            const returnedCount = resp?.likeCount ?? resp?.count ?? null;
            if (returnedCount !== null) {
                setComments(prev => prev.map(c => String(c.id) === String(sid) ? { ...c, likeCount: Number(returnedCount) } : c));
            }

        } catch (e) {
            console.error('좋아요 처리 실패', e);
            setLikedCommentIds((prev) => {
                const next = new Set(prev);
                wasLiked ? next.add(sid) : next.delete(sid);
                return next;
            });
            setComments((prev) => prev.map((c) => {
                if (String(c.id) !== String(sid)) return c;
                return { ...c, likeCount: prevCount, likedByMe: wasLiked };
            }));

            alert(e?.message || '좋아요 처리에 실패했습니다.');
        } finally {
            setPendingCommentLikes((prev) => {
                const next = new Set(prev);
                next.delete(sid);
                return next;
            });
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

        const sid = normalizeId(commentId);

        if (deleteLoading[sid]) return;
        setDeleteLoading(prev => ({ ...prev, [sid]: true }));

        const idx = comments.findIndex(c => String(c.id) === String(sid));
        const original = idx !== -1 ? comments[idx] : null;

        setComments(prev => prev.filter(c => String(c.id) !== String(sid)));

        try {
            const resp = await deleteComment(commentId, token);
            try { console.debug('[Community] deleteComment response', resp); } catch (e) { /* ignore */ }

            if (resp && resp.__error) {
                if (resp.status === 400 || resp.status === 404) {
                    try {
                        const fresh = await getCommentsByPost(selectedPost.id, token);
                        if (!(fresh && fresh.__error)) {
                            const list = extractCommentsArray(fresh).map(normalizeComment);
                            setComments(list);
                            setSelectedPost(prev => {
                                if (!prev || prev.id !== selectedPost.id) return prev;
                                return { ...prev, commentCount: list.length };
                            });
                        } else {
                        }
                    } catch (e) {
                        console.warn('댓글 삭제 후 목록 동기화 실패', e);
                    }
                } else if (resp.isServerError || (resp.status && Number(resp.status) >= 500)) {
                    setComments(prev => {
                        const copy = [...prev];
                        if (original) {
                            const exists = copy.some(c => c.id === original.id);
                            if (!exists) {
                                const insertAt = Math.min(Math.max(0, idx), copy.length);
                                copy.splice(insertAt, 0, original);
                            }
                        }
                        return copy;
                    });
                    try { console.error('댓글 삭제 실패 (서버 오류)', { status: resp.status, message: resp.message, body: resp.body }); } catch (e) { /* ignore */ }
                    alert('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
                } else {
                    setComments(prev => {
                        const copy = [...prev];
                        if (original) copy.splice(idx, 0, original);
                        return copy;
                    });
                    console.error('댓글 삭제 실패 (클라이언트 오류)', resp.status, resp.message || resp.body);
                    alert(resp.message || '댓글 삭제 실패');
                }
            } else {
                if (resp && resp.updatedComments) {
                    setComments(resp.updatedComments.map(normalizeComment));
                }
            }

            if (editingCommentId === sid || editingCommentId === commentId) handleCancelEditComment();
            setCommentMenuOpenId(null);
        } catch (err) {
            console.error('댓글 삭제 요청 중 오류', err);
            setComments(prev => {
                const copy = [...prev];
                if (original) {
                    const exists = copy.some(c => String(c.id) === String(original.id));
                    if (!exists) {
                        const insertAt = Math.min(Math.max(0, idx), copy.length);
                        copy.splice(insertAt, 0, original);
                    }
                }
                return copy;
            });
            alert(err?.message || '댓글 삭제 중 네트워크 오류가 발생했습니다. 잠시 후 다시 시도하세요.');
        } finally {
            setDeleteLoading(prev => ({ ...prev, [sid]: false }));
        }
    };


    const handleSaveDraft = async () => {
        const token = getToken();
        if (!token) return alert("로그인 필요");
        try {
            await saveDraft({ title, content }, token, isEditing && selectedPost?.id ? selectedPost.id : undefined);
            alert("임시저장 완료");
        }
        catch (e) { console.error("임시저장 실패", e); alert(e?.message || '임시저장 실패'); }
    };

    if (loading) return <p className="p-6 text-white">로딩중...</p>;


    if (mode === "list") {
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


                <div>
                    {posts.map((post, idx) => (
                        <div
                            key={post.id || idx}
                            className={`px-4 py-4 ${idx !== 0 ? 'border-t border-white/10' : ''} hover:bg-white/5 cursor-pointer`}
                            onClick={() => openDetail(post.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter') openDetail(post.id); }}
                        >

                            <div className="mt-2 text-base font-semibold text-white leading-snug">
                                {post.title}
                            </div>

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

                            <div className="mt-3 text-sm text-gray-200 line-clamp-2">
                                {post.content}
                            </div>

                            <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
                                <span className="inline-flex items-center gap-1">
                                    <span aria-hidden="true">👁️</span>
                                    <span className="tabular-nums">{typeof post.viewCount === 'number' ? post.viewCount : 0}</span>
                                </span>
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-1 hover:text-white"
                                    onClick={(e) => { e.stopPropagation(); togglePostLike(post.id); }}
                                    aria-label="좋아요"
                                >
                                    <span aria-hidden="true">{likedPostIds.has(post.id) ? '❤️' : '🤍'}</span>
                                    <span className="tabular-nums">
                                        {typeof optimisticLikeCountByPostId[post.id] === 'number'
                                            ? optimisticLikeCountByPostId[post.id]
                                            : (typeof post.likeCount === 'number' ? post.likeCount : 0)}
                                    </span>
                                </button>
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


    if (mode === "write") {
        return (
            <div className="p-6 text-white max-w-3xl mx-auto">
                <div className="mb-4 flex items-center">
                    <button
                        onClick={() => {
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
                        {isEditing ? "수정 완료" : "발행"}
                    </button>
                    <button
                        onClick={handleSaveDraft}
                        className="px-3 py-1 bg-white/5 rounded transition-colors hover:bg-indigo-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        저장
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

    if (mode === "detail" && selectedPost) {
        return (
            <div className="p-0 pb-24 text-white max-w-3xl mx-auto">
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

                <div className="px-1">
                    <div className="px-4 py-4">
                        <div className="flex items-center justify-between text-sm mb-3">
                            <div />
                        </div>

                        <h2 className="text-xl md:text-2xl font-bold leading-snug text-white">
                            {selectedPost.title}
                        </h2>

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

                                <div className="ml-auto relative" ref={postMenuRef}>
                                    <button className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/15">태그</button>
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

                        <div className="mt-4 border-t border-white/10" />
                        <div className="mt-4 text-sm text-gray-200 whitespace-pre-wrap">
                            {selectedPost.content}
                        </div>


                        <div className="mt-5 flex items-center gap-6 text-sm text-gray-300">
                            <button
                                type="button"
                                className="inline-flex items-center gap-2 hover:text-white"
                                onClick={(e) => { e.stopPropagation(); togglePostLike(selectedPost.id); }}
                                aria-label="좋아요"
                            >
                                <span aria-hidden="true">{selectedPostLiked ? '❤️' : '🤍'}</span>
                                <span className="tabular-nums">
                                    {typeof optimisticLikeCountByPostId[selectedPost.id] === 'number'
                                        ? optimisticLikeCountByPostId[selectedPost.id]
                                        : (typeof selectedPost.likeCount === 'number' ? selectedPost.likeCount : 0)}
                                </span>
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
                            <button type="button" className="ml-auto hover:text-white">공유하기</button>
                        </div>
                    </div>
                </div>

                <div className="mt-6 px-1 border-t border-white/10">
                    <div className="px-4 py-3 flex items-center justify-between">
                        <div className="text-base font-semibold">댓글 {comments.length}</div>
                        <div className="relative">
                            <button
                                className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/15"
                                onClick={() => setShowSortMenu((s) => !s)}
                                aria-haspopup="true"
                                aria-expanded={showSortMenu}
                            >
                                {sortBy === 'likes' ? '추천순' : '최신순'}
                            </button>
                            {showSortMenu && (
                                <div className="absolute right-0 mt-2 w-36 bg-[#0b0f19] border border-white/10 rounded-lg shadow-lg z-20">
                                    <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/10" onClick={() => { setSortBy('likes'); setShowSortMenu(false); }}>추천순</button>
                                    <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/10" onClick={() => { setSortBy('latest'); setShowSortMenu(false); }}>최신순</button>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="px-4 py-4">
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
                            {getSortedComments().map((c) => (
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

                                                <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                                                    <span className="inline-flex items-center gap-1">
                                                        <span aria-hidden="true">🕒</span>
                                                        <span>{formatRelativeDays(c.createdAt)}</span>
                                                    </span>
                                                    <span className="inline-flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            className={`inline-flex items-center gap-1 hover:text-white ${isPendingComment(c.id) ? 'opacity-60 pointer-events-none' : ''}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (isPendingComment(c.id)) return;
                                                                toggleCommentLike(c.id);
                                                            }}
                                                            aria-label="댓글 좋아요"
                                                            aria-busy={isPendingComment(c.id) ? 'true' : 'false'}
                                                            disabled={isPendingComment(c.id)}
                                                        >
                                                            <span aria-hidden="true">{isLikedComment(c.id) ? '❤️' : '🤍'}</span>
                                                            <span className="tabular-nums">{typeof c.likeCount === 'number' ? c.likeCount : 0}</span>
                                                        </button>
                                                    </span>
                                                    <span className="inline-flex items-center gap-1">
                                                        <span aria-hidden="true">💬</span>
                                                        <span className="tabular-nums">{typeof c.replyCount === 'number' ? c.replyCount : 0}</span>
                                                    </span>

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
                                                                        if (deleteLoading[c.id]) return; // prevent duplicate clicks
                                                                        handleDeleteComment(c.id);
                                                                    }}
                                                                    disabled={Boolean(deleteLoading[c.id])}
                                                                    aria-busy={Boolean(deleteLoading[c.id])}
                                                                >
                                                                    {deleteLoading[c.id] ? '삭제...' : '삭제'}
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