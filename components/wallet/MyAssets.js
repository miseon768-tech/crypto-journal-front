import React from "react";

export default function MyAssets({summary, krwInput, setKrwInput, handleAddKrw}) {
    return (
        <div className="space-y-4">
            <section className="rounded-2xl bg-white/5 p-5 border border-white/5">
                <div className="mt-4 grid grid-cols-2 gap-6">
                    <div>
                        <div className="text-sm text-white/60">보유 KRW</div>
                        <div className="mt-2 text-4xl font-semibold tabular-nums">
                            {Number(summary.cashBalance || 0).toLocaleString()}
                        </div>
                    </div>

                    <div className="border-l border-white/10 pl-6">
                        <div className="text-sm text-white/60">보유자산</div>
                        <div className="mt-2 text-4xl font-semibold tabular-nums">
                            {Number(summary.totalAsset || 0).toLocaleString()}
                        </div>
                    </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-x-10 gap-y-3 text-sm">
                    <MetricRow label="총 매수" value={`${Number(summary.totalBuyAmount || 0).toLocaleString()} KRW`}/>
                    <MetricRow label="평가손익" value={`${Number(summary.totalProfit || 0).toLocaleString()} KRW`}
                               valueClass={Number(summary.totalProfit || 0) >= 0 ? "text-red-400" : "text-blue-400"}/>
                    <MetricRow label="총 평가" value={`${Number(summary.totalEval || 0).toLocaleString()} KRW`}/>
                    <MetricRow label="수익률" value={`${Number(summary.profitRate || 0).toLocaleString()}%`}
                               valueClass={Number(summary.profitRate || 0) >= 0 ? "text-red-400" : "text-blue-400"}/>
                    <MetricRow label="주문가능" value={`${Number(summary.cashBalance || 0).toLocaleString()} KRW`}/>
                    <div/>
                </div>
            </section>

            <section className="rounded-2xl bg-white/5 p-5 border border-white/5">
                <div className="text-sm font-semibold mb-3">보유 현금 (KRW) 등록/수정</div>

                <div className="flex gap-2">
                    <input
                        type="number"
                        value={krwInput}
                        onChange={(e) => setKrwInput(e.target.value)}
                        placeholder="보유 KRW 금액 입력"
                        className="px-3 py-2 rounded-lg bg-white/10 flex-1"
                        min="0"
                    />
                    <button onClick={handleAddKrw}
                            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg font-semibold transition shrink-0">
                        등록/수정
                    </button>
                </div>

                <div className="mt-3 text-sm text-white/70">
                    현재 보유:{" "}
                    <span className="font-bold text-white">{Number(summary.cashBalance || 0).toLocaleString()}원</span>
                </div>
            </section>
        </div>
    );
}

function MetricRow({label, value, valueClass = "text-white"}) {
    return (
        <div className="grid grid-cols-[88px_1fr] items-center">
            <span className="text-white/60">{label}</span>
            <span className={`tabular-nums text-right ${valueClass}`}>{value}</span>
        </div>
    );
}