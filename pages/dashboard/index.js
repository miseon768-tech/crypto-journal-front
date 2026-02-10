import { useRouter } from "next/router";

export default function Dashboard() {
    const router = useRouter();

    return (
        <div className="p-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                <div className="bg-white/10 backdrop-blur-lg p-6 rounded-2xl shadow-xl hover:scale-105 transition">
                    <h2 className="text-xl font-semibold mb-4">총 자산</h2>
                    <p className="text-3xl font-bold text-green-400">$12,450</p>
                    <p className="text-sm text-gray-300 mt-2">+5.4% 이번 달</p>
                </div>

                <div className="bg-white/10 backdrop-blur-lg p-6 rounded-2xl shadow-xl hover:scale-105 transition">
                    <h2 className="text-xl font-semibold mb-4">작성한 기록</h2>
                    <p className="text-3xl font-bold">27개</p>
                    <p className="text-sm text-gray-300 mt-2">최근 작성: 2일 전</p>
                </div>

                <div className="bg-white/10 backdrop-blur-lg p-6 rounded-2xl shadow-xl hover:scale-105 transition">
                    <h2 className="text-xl font-semibold mb-4">최근 활동</h2>
                    <ul className="text-sm text-gray-300 space-y-1">
                        <li>• BTC 매수 기록 추가</li>
                        <li>• ETH 분석 작성</li>
                        <li>• 로그인</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}