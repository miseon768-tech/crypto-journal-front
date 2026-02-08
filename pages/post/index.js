import { useEffect, useState } from "react";
import { getPosts } from "../api/post";

export default function PostListPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPosts()
      .then((res) => {
        setPosts(res.posts || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans">
        <p className="text-gray-700 text-lg">Loading...</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
          글 목록
        </h1>

        {posts.length === 0 ? (
          <p className="text-gray-700 text-center">글이 없습니다.</p>
        ) : (
          <ul className="space-y-4">
            {posts.map((post) => (
              <li key={post.id}>
                <a
                  href={`/post/${post.id}`}
                  className="block p-4 bg-white rounded-lg shadow hover:bg-gray-100 transition text-gray-900 font-medium"
                >
                  {post.title}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
