import { useEffect, useState } from "react";
import { addComment, getCommentsByPost } from "../api/comment";

export default function CommentPage({ postId }) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCommentsByPost(postId)
      .then((res) => {
        setComments(res.comments || []);
        setLoading(false);
      })
      .catch(console.error);
  }, [postId]);

  const handleAdd = async () => {
    try {
      const added = await addComment({ postId, content: newComment }, token);
      setComments((prev) => [...prev, added]);
      setNewComment("");
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ maxWidth: 600, margin: "auto", padding: 20 }}>
      <h1>댓글</h1>

      <div>
        <input
          placeholder="댓글 작성"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
        />
        <button onClick={handleAdd}>작성</button>
      </div>

      <ul>
        {comments.map((c) => (
          <li key={c.id}>
            <strong>{c.memberName}</strong>: {c.content}
          </li>
        ))}
      </ul>
    </div>
  );
}
