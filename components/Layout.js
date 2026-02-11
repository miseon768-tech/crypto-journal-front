import { useRouter } from "next/router";

export default function Layout({ children }) {
    const router = useRouter();

    const handleLogout = () => {
        localStorage.removeItem("token");
        router.push("/login");
    };

    const handleMyInfo = () => {
        router.push("/mypage"); // 내 정보 페이지로 이동
    };

    const openDashboardTab = (tab) => {
        // shallow 옵션으로 페이지 전체 리로드 없이 쿼리만 변경
        router.push({ pathname: '/dashboard', query: { tab }}, undefined, { shallow: true });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">

            {/* Header */}
            <header className="border-b border-white/10 bg-black/30 backdrop-blur-md">
                <div className="max-w-6xl mx-auto px-10 py-4 flex justify-between items-center">

                    <h1
                        onClick={() => router.push("/dashboard")}
                        className="text-lg font-semibold tracking-wide cursor-pointer hover:text-gray-300 transition"
                    >
                        Crypto Journal
                    </h1>

                    {/* ===== 오른쪽 버튼 ===== */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleMyInfo}
                            className="px-4 py-2 bbg-white/10 rounded-lg hover:bg-white/20 transition"
                        >
                            내 정보
                        </button>
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 bbg-white/10 rounded-lg hover:bg-white/20 transition"
                        >
                            로그아웃
                        </button>
                    </div>

                </div>
            </header>

            {/* Content */}
            <main className="p-10">
                <div className="max-w-6xl mx-auto">
                    {children}
                </div>
            </main>

        </div>
    );
}