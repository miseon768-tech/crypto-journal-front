import { useEffect, useState } from "react";
import { getDrafts, saveDraft } from "../../api/post";

export default function DraftPage() {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [drafts, setDrafts] = useState([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) return;
    getDrafts(token)
      .then((res) => setDrafts(res.draftList || []))
      .catch(console.error);
  }, [token]);

  const handleSave = async () => {
    try {
      const saved = await saveDraft({ title, content }, token);
      setDrafts((prev) => [
        {
          id: saved.id,
          title: saved.title,
          content,
          updatedAt: saved.savedAt,
        },
        ...prev,
      ]);
      setTitle("");
      setContent("");
      setMessage("임시 저장 완료");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessage(err.message);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
      <div className="w-full max-w-lg bg-white p-8 rounded-2xl shadow-lg">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
          임시 저장 글
        </h1>

        {/* 새 임시 글 작성 */}
        <div className="flex flex-col gap-4 mb-6">
          <input
            placeholder="제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 text-gray-800 placeholder-gray-400"
          />
          <textarea
            placeholder="내용"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            className="p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 text-gray-800 placeholder-gray-400 resize-none"
          />
          <button
            onClick={handleSave}
            className="p-3 bg-gray-800 text-white font-semibold rounded-lg hover:bg-gray-900 transition"
          >
            임시 저장
          </button>
          {message && (
            <p className="text-gray-600 text-sm text-center mt-1">{message}</p>
          )}
        </div>

        {/* 저장된 임시 글 목록 */}
        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            저장된 임시 글 목록
          </h2>
          {drafts.length === 0 ? (
            <p className="text-gray-500">저장된 글이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {drafts.map((draft) => (
                <li
                  key={draft.id}
                  className="p-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-800"
                >
                  <p className="font-medium">{draft.title}</p>
                  {draft.content && (
                    <p className="text-sm text-gray-500 mt-1">
                      {draft.content}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
