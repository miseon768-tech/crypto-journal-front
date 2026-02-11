import { useState } from "react";
import WalletComponent from "../../components/WalletComponent";
import RealtimeComponent from "../../components/RealtimeComponent";
import CommunityComponent from "../../components/CommunityComponent";

export default function Dashboard() {
    const [activeTab, setActiveTab] = useState(null);

    // 각 컴포넌트 key
    const [walletKey, setWalletKey] = useState(0);
    const [realtimeKey, setRealtimeKey] = useState(0);
    const [communityKey, setCommunityKey] = useState(0);

    return (
        <div className="p-10">
            {/* ===== 카드 선택 영역 ===== */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">

                <div
                    onClick={() => {
                        setActiveTab("wallet");
                        setWalletKey(prev => prev + 1); // 클릭 시 강제 리렌더 가능
                    }}
                    className="bg-white/10 backdrop-blur-lg p-6 rounded-2xl shadow-xl hover:scale-105 transition cursor-pointer flex items-center justify-center"
                >
                    <h2 className="text-xl font-semibold">Wallet</h2>
                </div>

                <div
                    onClick={() => {
                        setActiveTab("realtime");
                        setRealtimeKey(prev => prev + 1);
                    }}
                    className="bg-white/10 backdrop-blur-lg p-6 rounded-2xl shadow-xl hover:scale-105 transition cursor-pointer flex items-center justify-center"
                >
                    <h2 className="text-xl font-semibold">Realtime</h2>
                </div>

                <div
                    onClick={() => {
                        setActiveTab("community");
                        setCommunityKey(prev => prev + 1);
                    }}
                    className="bg-white/10 backdrop-blur-lg p-6 rounded-2xl shadow-xl hover:scale-105 transition cursor-pointer flex items-center justify-center"
                >
                    <h2 className="text-xl font-semibold">Community</h2>
                </div>
            </div>

            {/* ===== 내용 영역 ===== */}
            <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-md min-h-[200px]">
                {!activeTab && <div>카드를 클릭하면 내용이 여기에 표시됩니다.</div>}

                {activeTab === "wallet" && (
                    <WalletComponent key={walletKey} />
                )}

                {activeTab === "realtime" && (
                    <RealtimeComponent key={realtimeKey} />
                )}

                {activeTab === "community" && (
                    <CommunityComponent key={communityKey} />
                )}
            </div>
        </div>
    );
}