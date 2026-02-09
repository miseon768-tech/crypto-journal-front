import { useEffect, useState } from "react";
import { getPosts, searchPosts } from "../api/post";

export default function PostListPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");

  const fetchAll = async () => {
    const res = await getPosts();
    setPosts(res.postList || []);
  };

  useEffect(() => {
    fetchAll()
      .then(() => setLoading(false))
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleSearch = async () => {
    if (!keyword.trim()) {
      fetchAll();
      return;
    }
    const res = await searchPosts(keyword.trim());
    setPosts(res.postList || []);
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans">
        <p className="text-gray-700 text-lg">Loading...</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">글 목록</h1>
          <div className="flex gap-2">
            <a
              href="/post/create"
              className="px-3 py-2 bg-gray-800 text-white rounded"
            >
              글 작성
            </a>
            <a
              href="/post/my"
              className="px-3 py-2 border border-gray-300 rounded"
            >
              내 글
            </a>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            className="flex-1 p-3 border border-gray-300 rounded-lg"
            placeholder="키워드 검색"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <button
            onClick={handleSearch}
            className="px-4 py-3 bg-gray-800 text-white rounded-lg"
          >
            검색
          </button>
        </div>

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
