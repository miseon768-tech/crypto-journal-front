import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  getPostById,
  deletePost,
  updatePost,
  likePost,
  unlikePost,
  getPostLikeCount,
} from "../../api/post";

export default function PostDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [post, setPost] = useState(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [likeCount, setLikeCount] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchDetail = async () => {
      const res = await getPostById(id);
      setPost(res.post);
      setTitle(res.post.title);
      setContent(res.post.content);
      const likeRes = await getPostLikeCount(id);
      setLikeCount(likeRes.likeCount ?? likeRes.postLikeCount ?? 0);
      setLoading(false);
    };

    fetchDetail().catch((err) => {
      console.error(err);
      setLoading(false);
    });
  }, [id]);

  const handleUpdate = async () => {
    try {
      const updated = await updatePost(id, { title, content }, token);
      setPost(updated.post);
      alert("수정 완료");
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async () => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      await deletePost(id, token);
      router.push("/post");
    } catch (err) {
      alert(err.message);
    }
  };

  const handleLike = async () => {
    if (!token || likeLoading) return;
    setLikeLoading(true);
    try {
      await likePost(id, token);
      const likeRes = await getPostLikeCount(id);
      setLikeCount(likeRes.likeCount ?? likeRes.postLikeCount ?? 0);
    } finally {
      setLikeLoading(false);
    }
  };

  const handleUnlike = async () => {
    if (!token || likeLoading) return;
    setLikeLoading(true);
    try {
      await unlikePost(id, token);
      const likeRes = await getPostLikeCount(id);
      setLikeCount(likeRes.likeCount ?? likeRes.postLikeCount ?? 0);
    } finally {
      setLikeLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!post) return <div>글을 찾을 수 없습니다.</div>;

  return (
    <div style={{ maxWidth: 600, margin: "auto", padding: 20 }}>
      <h1>글 상세</h1>
      <input value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea value={content} onChange={(e) => setContent(e.target.value)} />
      <div style={{ marginTop: 8 }}>
        <button onClick={handleUpdate}>수정</button>
        <button onClick={handleDelete}>삭제</button>
      </div>
      <div style={{ marginTop: 12 }}>
        <span>좋아요: {likeCount}</span>
        <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
          <button onClick={handleLike} disabled={!token || likeLoading}>
            좋아요
          </button>
          <button onClick={handleUnlike} disabled={!token || likeLoading}>
            좋아요 취소
          </button>
        </div>
      </div>
    </div>
  );
}
