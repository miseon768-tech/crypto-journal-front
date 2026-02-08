import { useEffect, useState } from "react";
import { getDrafts, saveDraft } from "../../api/post";

export default function DraftPage() {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [drafts, setDrafts] = useState([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    getDrafts(token)
      .then((res) => setDrafts(res.drafts || []))
      .catch(console.error);
  }, [token]);

  const handleSave = async () => {
    try {
      const saved = await saveDraft({ title, content }, token);
      setDrafts((prev) => [...prev, saved]);
      setTitle("");
      setContent("");
      alert("임시 저장 완료");
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "auto", padding: 20 }}>
      <h1>임시 저장 글</h1>

      <div>
        <h2>새 임시 글</h2>
        <input
          placeholder="제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          placeholder="내용"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <button onClick={handleSave}>임시 저장</button>
      </div>

      <div>
        <h2>저장된 임시 글 목록</h2>
        {drafts.length === 0 && <p>저장된 글이 없습니다.</p>}
        <ul>
          {drafts.map((draft) => (
            <li key={draft.id}>{draft.title}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
