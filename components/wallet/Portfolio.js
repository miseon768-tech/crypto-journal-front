import React, { useMemo, useEffect, useState } from "react";
import dynamic from "next/dynamic";

// react-chartjs-2 Doughnut을 클라이언트에서만 로드
const Doughnut = dynamic(
    () => import("react-chartjs-2").then((mod) => mod.Doughnut),
    { ssr: false }
);

export default function Portfolio({ portfolio = [] }) {
    const list = Array.isArray(portfolio) ? portfolio : [];

    // chart.js 및 플러그인 등록은 클라이언트에서만 수행
    const [chartReady, setChartReady] = useState(false);
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const ChartJS = await import("chart.js");
                // ChartJS.Chart.register(...) 형태로 등록
                ChartJS.Chart.register(ChartJS.ArcElement, ChartJS.Tooltip, ChartJS.Legend);
                if (mounted) setChartReady(true);
            } catch (e) {
                console.error("Failed to load chart.js:", e);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    const { labels, dataValues, total } = useMemo(() => {
        const lbls = list.map((p) => p.tradingPair ?? p.market ?? "Unknown");
        const vals = list.map((p) => Number(p.valuation ?? 0));
        const tot = vals.reduce((s, v) => s + v, 0);
        return { labels: lbls, dataValues: vals, total: tot };
    }, [list]);

    if (list.length === 0 || total === 0) {
        return (
            <section className="rounded-2xl bg-white/5 p-5 border border-white/5">
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div className="flex justify-center">
                        <div className="h-56 w-56 rounded-full border border-white/10 flex items-center justify-center text-white/60">
                            도넛차트 자리
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="text-white/50 text-sm">포트폴리오 데이터가 없습니다.</div>
                    </div>
                </div>
            </section>
        );
    }

    // 색상 팔레트
    const palette = [
        "#FF6384","#36A2EB","#FFCE56","#4BC0C0","#9966FF","#FF9F40",
        "#8A2BE2","#00CED1","#FFD700","#DC143C","#20B2AA","#7B68EE"
    ];
    const bgColors = labels.map((_, i) => palette[i % palette.length]);

    const chartData = {
        labels,
        datasets: [
            {
                data: dataValues,
                backgroundColor: bgColors,
                hoverBackgroundColor: bgColors,
                borderWidth: 0,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: "right",
                labels: { color: "#fff", boxWidth: 12, padding: 12 },
            },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        const val = Number(context.raw ?? 0);
                        const pct = ((val / total) * 100).toFixed(2);
                        return `${context.label}: ${val.toLocaleString()} KRW (${pct}%)`;
                    },
                },
            },
        },
    };

    return (
        <section className="rounded-2xl bg-white/5 p-5 border border-white/5">
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="flex justify-center">
                    <div className="h-56 w-56">
                        <div style={{ height: "100%", position: "relative" }}>
                            {chartReady ? <Doughnut data={chartData} options={options} /> : (
                                <div className="h-full flex items-center justify-center text-white/60">로딩중...</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    {list.map((p, idx) => (
                        <div key={p.tradingPair ?? p.market ?? idx} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span style={{ background: bgColors[idx] }} className="h-3 w-3 rounded-full inline-block" />
                                <span className="font-medium">{p.tradingPair ?? p.market}</span>
                            </div>
                            <div className="tabular-nums text-white/80">{((Number(p.valuation ?? 0) / total) * 100).toFixed(1)}%</div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}