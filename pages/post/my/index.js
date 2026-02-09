import { useEffect, useState } from "react";
import { getMyPosts } from "../../api/post";

export default function MyPostsPage() {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyPosts(token)
      .then((res) => {
        setPosts(res.postList || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [token]);

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ maxWidth: 800, margin: "auto", padding: 20 }}>
      <h1>내가 쓴 글</h1>
      {posts.length === 0 && <p>작성한 글이 없습니다.</p>}
      <ul>
        {posts.map((post) => (
          <li key={post.id}>
            <a href={`/post/${post.id}`}>{post.title}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
