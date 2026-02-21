import React from "react";

export default function Portfolio({ portfolio = [] }) {
    // 안전 검사: portfolio가 배열이 아니면 빈 배열로 처리
    const list = Array.isArray(portfolio) ? portfolio : [];

    return (
        <section className="rounded-2xl bg-white/5 p-5 border border-white/5">
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="flex justify-center">
                    <div className="h-56 w-56 rounded-full border border-white/10 flex items-center justify-center text-white/60">
                        도넛차트 자리
                    </div>
                </div>

                <div className="space-y-3">
                    {list.length === 0 ? (
                        <div className="text-white/50 text-sm">포트폴리오 데이터가 없습니다.</div>
                    ) : (
                        list.map((p) => (
                            <div key={p.tradingPair} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="h-3 w-3 rounded-full bg-green-400/80" />
                                    <span className="font-medium">{p.tradingPair}</span>
                                </div>
                                <div className="tabular-nums text-white/80">{Number(p.percent || 0).toFixed(1)}%</div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </section>
    );
}