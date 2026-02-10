import { useRouter } from "next/router";

export default function Dashboard() {
    const router = useRouter();

    return (
        <div className="p-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                {/* Wallet 카드 */}
                <div
                    onClick={() => router.push("/wallet")}
                    className="bg-white/10 backdrop-blur-lg p-6 rounded-2xl shadow-xl hover:scale-105 transition cursor-pointer flex items-center justify-center"
                >
                    <h2 className="text-xl font-semibold">Wallet</h2>
                </div>

                {/* Realtime 카드 */}
                <div
                    onClick={() => router.push("/realtime")}
                    className="bg-white/10 backdrop-blur-lg p-6 rounded-2xl shadow-xl hover:scale-105 transition cursor-pointer flex items-center justify-center"
                >
                    <h2 className="text-xl font-semibold">Realtime</h2>
                </div>

                {/* Community 카드 */}
                <div
                    onClick={() => router.push("/community")}
                    className="bg-white/10 backdrop-blur-lg p-6 rounded-2xl shadow-xl hover:scale-105 transition cursor-pointer flex items-center justify-center"
                >
                    <h2 className="text-xl font-semibold">Community</h2>
                </div>
            </div>
        </div>
    );
}