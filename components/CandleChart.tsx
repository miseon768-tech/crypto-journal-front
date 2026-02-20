"use client";

import { useEffect, useMemo, useRef } from "react";

type CandlePoint = {
    time: number; // seconds (오름차순 필수)
    open: number;
    high: number;
    low: number;
    close: number;
};

export default function CandleChart({ data }: { data: CandlePoint[] }) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const chartRef = useRef<any>(null);
    const seriesRef = useRef<any>(null);

    const sorted = useMemo(() => {
        if (!Array.isArray(data)) return [];
        // time 오름차순 + time 중복 제거(마지막 값 승)
        const m = new Map<number, CandlePoint>();
        for (const p of data) m.set(p.time, p);
        return Array.from(m.values()).sort((a, b) => a.time - b.time);
    }, [data]);

    // 차트 1회 생성
    useEffect(() => {
        let chart: any;
        let onResize: any;

        const init = async () => {
            if (!containerRef.current) return;

            const w = containerRef.current.clientWidth;
            if (!w) return; // width=0이면 assertion 날 수 있어 방지

            const lwc = await import("lightweight-charts");
            const { createChart, ColorType, CandlestickSeries } = lwc as any;

            chart = createChart(containerRef.current, {
                layout: {
                    background: { type: ColorType.Solid, color: "transparent" },
                    textColor: "white",
                },

                // ✅ 워터마크(로고) 숨기기
                watermark: {
                    visible: false,
                },

                grid: {
                    vertLines: { color: "rgba(255,255,255,0.08)" },
                    horzLines: { color: "rgba(255,255,255,0.08)" },
                },
                height: 260,
                width: w,
                timeScale: { timeVisible: true, secondsVisible: true },
                rightPriceScale: { borderColor: "rgba(255,255,255,0.15)" },
            });

            const series = chart.addSeries(CandlestickSeries, {
                upColor: "#22c55e",
                downColor: "#ef4444",
                borderUpColor: "#22c55e",
                borderDownColor: "#ef4444",
                wickUpColor: "#22c55e",
                wickDownColor: "#ef4444",
            });

            chartRef.current = chart;
            seriesRef.current = series;

            // 최초 데이터 반영
            series.setData(sorted);
            chart.timeScale().fitContent();

            onResize = () => {
                if (!containerRef.current) return;
                const nw = containerRef.current.clientWidth;
                if (!nw) return;
                chart.applyOptions({ width: nw });
            };
            window.addEventListener("resize", onResize);
        };

        init();

        return () => {
            if (onResize) window.removeEventListener("resize", onResize);
            if (chart) chart.remove();
            chartRef.current = null;
            seriesRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 데이터 업데이트 (중복/정렬된 sorted를 넣음)
    useEffect(() => {
        if (!seriesRef.current) return;
        seriesRef.current.setData(sorted);
        chartRef.current?.timeScale()?.fitContent?.();
    }, [sorted]);

    return <div ref={containerRef} className="w-full" />;
}