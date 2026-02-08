import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getPostById, deletePost, updatePost } from "../../api/post";

export default function PostDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [post, setPost] = useState(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getPostById(id)
      .then((res) => {
        setPost(res.post);
        setTitle(res.post.title);
        setContent(res.post.content);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [id]);

  const handleUpdate = async () => {
    try {
      const updated = await updatePost(id, { title, content }, token);
      setPost(updated);
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

  if (loading) return <div>Loading...</div>;
  if (!post) return <div>글을 찾을 수 없습니다.</div>;

  return (
    <div style={{ maxWidth: 600, margin: "auto", padding: 20 }}>
      <h1>글 상세</h1>
      <input value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea value={content} onChange={(e) => setContent(e.target.value)} />
      <div>
        <button onClick={handleUpdate}>수정</button>
        <button onClick={handleDelete}>삭제</button>
      </div>
    </div>
  );
}
