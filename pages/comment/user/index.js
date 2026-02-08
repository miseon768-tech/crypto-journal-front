import { useEffect, useState } from "react";
import { getCommentsByUser } from "../../api/comment";

export default function MyCommentsPage() {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCommentsByUser(token)
      .then((res) => {
        setComments(res.comments || []);
        setLoading(false);
      })
      .catch(console.error);
  }, [token]);

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ maxWidth: 600, margin: "auto", padding: 20 }}>
      <h1>내 댓글</h1>
      {comments.length === 0 && <p>작성한 댓글이 없습니다.</p>}
      <ul>
        {comments.map((c) => (
          <li key={c.id}>
            <strong>{c.postTitle}</strong>: {c.content}
          </li>
        ))}
      </ul>
    </div>
  );
}
