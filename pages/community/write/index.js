import { useState } from "react";
import { useRouter } from "next/router";
import { createPost } from "../../../api/post";
import { useToken } from "../../../stores/account-store";

export default function CommunityWrite() {
    const router = useRouter();
    const { token: globalToken } = useToken();
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        const token = globalToken || localStorage.getItem("token");
        if (!token) {
            alert("로그인이 필요합니다.");
            router.replace("/login");
            return;
        }

        if (!title.trim() || !content.trim()) {
            alert("제목과 내용을 모두 입력해주세요.");
            return;
        }

        setSubmitting(true);
        try {
            await createPost({ title, content }, token);
            alert("글 작성 완료!");
            router.push("/community");
        } catch (err) {
            console.error(err);
            if (String(err).includes("403") || String(err).includes("401")) {
                alert("권한이 없습니다. 로그인 후 다시 시도해주세요.");
                localStorage.removeItem("token");
            } else {
                alert(err?.message || "글 작성 실패");
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen p-10 bg-gray-900 text-white">
            <div className="max-w-3xl mx-auto space-y-6">
                <input
                    type="text"
                    placeholder="제목"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-2 rounded bg-gray-800 text-white focus:outline-none"
                />
                <textarea
                    placeholder="내용"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full p-2 rounded bg-gray-800 text-white h-40 focus:outline-none"
                />
                <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className={`px-4 py-2 rounded ${submitting ? "bg-gray-600 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"}`}
                >
                    {submitting ? "작성 중..." : "작성"}
                </button>
            </div>
        </div>
    );
}