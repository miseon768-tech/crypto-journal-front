import { useState } from "react";
import { useRouter } from "next/router";
import { createPost } from "../../../api/post";
import { useToken } from "../../../stores/account-store";
import { getStoredToken } from "../../../api/member";

export default function CommunityWrite() {
    const router = useRouter();
    const { token: globalToken, setToken } = useToken();

    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        // getStoredToken을 통해 일관된 정규화 사용
        let token = getStoredToken(globalToken) || getStoredToken(localStorage.getItem("token"));
        console.log("CommunityWrite: 정규화된 토큰 길이/값 일부:", token ? { length: token.length, snippet: token.substring(0, 30) + '...' } : null);

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
            const res = await createPost({ title, content }, token);
            console.log("글 작성 성공:", res);

            // 토큰 갱신 필요 시 저장
            if (res?.token) {
                localStorage.setItem("token", res.token);
                setToken(res.token);
            }

            alert("글 작성 완료!");
            router.push("/community");
        } catch (err) {
            console.error("글 작성 에러:", err);
            alert(err.message || "글 작성 실패");
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
                    className="w-full p-3 rounded bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                <textarea
                    placeholder="내용"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full p-3 rounded bg-gray-800 text-white h-40 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className={`w-full py-3 rounded-xl font-medium transition ${
                        submitting
                            ? "bg-gray-600 cursor-not-allowed"
                            : "bg-blue-500 hover:bg-blue-600 hover:scale-105 hover:shadow-lg"
                    }`}
                >
                    {submitting ? "작성 중..." : "작성"}
                </button>
            </div>
        </div>
    );
}