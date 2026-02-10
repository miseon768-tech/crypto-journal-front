import {useRouter} from "next/router";

export default function Layout({children}) {
    const router = useRouter();

    const handleLogout = () => {
        localStorage.removeItem("token");
        router.push("/login");
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

                    <div className="flex gap-3 text-sm items-center">
                        <button
                            onClick={() => router.push("/mypage")}
                            className="px-4 py-2 rounded-lg hover:bg-white/10 transition-colors duration-200">
                        My Page
                        </button>

                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 rounded-lg hover:bg-white/10 transition-colors duration-200">
                        Logout
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