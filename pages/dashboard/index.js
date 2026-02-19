import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import WalletComponent from "../../components/WalletComponent";
import RealtimeComponent from "../../components/RealtimeComponent";
import CommunityComponent from "../../components/CommunityComponent";
import {getAllMarkets} from "../../api/tradingPair";

export default function Dashboard() {
    const router = useRouter();
    const queryTab = router.query.tab;

    const [activeTab, setActiveTab] = useState(null);
    const [tradingPairs, setTradingPairs] = useState([]); // API 데이터


    // 각 컴포넌트 key
    const [walletKey, setWalletKey] = useState(0);
    const [realtimeKey, setRealtimeKey] = useState(0);
    const [communityKey, setCommunityKey] = useState(0);

    // 쿼리 파라미터(tab)를 읽어 탭 설정
    useEffect(() => {
        if (!queryTab) return;
        // 허용된 값만 적용
        const allowed = ["wallet", "realtime", "community"];
        if (allowed.includes(queryTab)) {
            setActiveTab(queryTab);
            // 키 증가로 강제 리렌더
            if (queryTab === "wallet") setWalletKey(k => k + 1);
            if (queryTab === "realtime") setRealtimeKey(k => k + 1);
            if (queryTab === "community") setCommunityKey(k => k + 1);
        }
    }, [queryTab]);

    useEffect(() => {
        const fetchPairs = async () => {
            try {
                const data = await getAllMarkets();
                console.log("마켓 전체 응답:", data);

                setTradingPairs(data?.trading_pairs || []); // 🔥 여기 수정
            } catch (err) {
                console.error("Failed to fetch trading pairs:", err);
            }
        };
        fetchPairs();
    }, []);

    const openTab = (tab) => {
        // 내부 상태 변경
        setActiveTab(tab);
        // 쿼리 업데이트 (shallow로 페이지 리로드 방지)
        router.push({ pathname: '/dashboard', query: { tab } }, undefined, { shallow: true });
    };

    return (
        <div className="p-10">
            {/* ===== 카드 선택 영역 ===== */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
                <div
                    onClick={() => { openTab("wallet"); setWalletKey(k => k + 1); }}
                    className="bg-white/10 backdrop-blur-lg p-6 rounded-2xl shadow-xl hover:scale-105 transition cursor-pointer flex items-center justify-center"
                >
                    <h2 className="text-xl font-semibold">Wallet</h2>
                </div>

                <div
                    onClick={() => { openTab("realtime"); setRealtimeKey(k => k + 1); }}
                    className="bg-white/10 backdrop-blur-lg p-6 rounded-2xl shadow-xl hover:scale-105 transition cursor-pointer flex items-center justify-center"
                >
                    <h2 className="text-xl font-semibold">Realtime</h2>
                </div>

                <div
                    onClick={() => { openTab("community"); setCommunityKey(k => k + 1); }}
                    className="bg-white/10 backdrop-blur-lg p-6 rounded-2xl shadow-xl hover:scale-105 transition cursor-pointer flex items-center justify-center"
                >
                    <h2 className="text-xl font-semibold">community</h2>
                </div>
            </div>

            {/* ===== 내용 영역 ===== */}
            <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-md min-h-[200px]">
                {!activeTab && <div>카드를 클릭하면 내용이 여기에 표시됩니다.</div>}

                {activeTab === "wallet" && <WalletComponent key={walletKey} />}

                {activeTab === "realtime" &&
                    <RealtimeComponent key={realtimeKey} trading_pairs={tradingPairs} />
                }

                {activeTab === "community" && <CommunityComponent key={communityKey} />}
            </div>
        </div>
    );
}
