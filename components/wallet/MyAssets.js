import React, { useMemo } from "react";

export default function MyAssets({summary, krwInput, setKrwInput, handleAddKrw}) {
    const safe = useMemo(() => {
        const toNum = (v) => {
            const n = Number(v);
            return Number.isFinite(n) ? n : 0;
        };

        // '원' 단위는 소수점이 보이지 않도록 정수로 맞춘다.
        // (백엔드가 double로 내려주거나, 계산 중 소수점이 생겨도 UI에서는 원 단위로 표시)
        const toWonInt = (v) => Math.round(toNum(v));

        // 백엔드 API 응답 키값(totalAssets, totalEvalAmount 등)에 맞춰 pop 수행
        const totalAsset = toWonInt(summary?.totalAssets);
        const totalEval = toWonInt(summary?.totalEvalAmount);
        const totalProfit = toWonInt(summary?.totalProfit);
        const profitRate = toNum(summary?.totalProfitRate);
        const cashBalance = toWonInt(summary?.cashBalance);
        const totalBuyAmount = toWonInt(summary?.totalBuyAmount);

        return {
            totalAsset,
            totalAssetDisplay: totalAsset > 0 ? totalAsset : (totalEval + cashBalance),
            totalEval,
            totalProfit,
            profitRate,
            cashBalance,
            totalBuyAmount,
        };
    }, [summary]);

    return (
        <div className="space-y-4">
            <section className="rounded-2xl bg-white/5 p-5 border border-white/5">
                <div className="text-sm font-semibold mb-3">보유현금(KRW)</div>
                <div className="flex gap-2">
                    <input
                        type="number"
                        value={krwInput || ""}
                        onChange={(e) => setKrwInput(e.target.value)}
                        placeholder="보유 KRW 금액 입력"
                        className="px-3 py-2 rounded-lg bg-white/10 flex-1 text-white"
                        min="0"
                    />
                    <button onClick={handleAddKrw}
                            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg font-semibold transition shrink-0 text-white">
                        등록/수정
                    </button>
                </div>
                <div className="mt-3 text-sm text-white/70">
                    현재 보유: <span className="font-bold text-white">{safe.cashBalance.toLocaleString()}원</span>
                </div>
            </section>

            <section className="rounded-2xl bg-white/5 p-5 border border-white/5">
                <div className="mt-4 grid grid-cols-2 gap-6">
                    <div>
                        <div className="text-sm text-white/60">보유현금</div>
                        <div className="mt-2 text-4xl font-semibold tabular-nums text-white">
                            {safe.cashBalance.toLocaleString()}
                        </div>
                    </div>
                    <div className="border-l border-white/10 pl-6">
                        <div className="text-sm text-white/60">보유자산</div>
                        <div className="mt-2 text-4xl font-semibold tabular-nums text-white">
                            {safe.totalAssetDisplay.toLocaleString()}
                        </div>
                    </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-x-10 gap-y-3 text-sm">
                    <MetricRow label="총 매수" value={`${safe.totalBuyAmount.toLocaleString()} 원`}/>
                    <MetricRow label="평가손익" value={`${safe.totalProfit.toLocaleString()} 원`}
                               valueClass={safe.totalProfit >= 0 ? "text-red-400" : "text-blue-400"}/>
                    <MetricRow label="총 평가" value={`${safe.totalEval.toLocaleString()} 원`}/>
                    <MetricRow label="총 수익률" value={`${safe.profitRate.toFixed(2)}%`}
                               valueClass={safe.profitRate >= 0 ? "text-red-400" : "text-blue-400"}/>
                    <MetricRow label="주문가능" value={`${safe.cashBalance.toLocaleString()} 원`}/>
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