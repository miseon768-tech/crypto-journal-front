import React, { useMemo, useEffect, useState } from "react";
import dynamic from "next/dynamic";

// react-chartjs-2 Doughnut을 클라이언트에서만 로드
const Doughnut = dynamic(
    () => import("react-chartjs-2").then((mod) => mod.Doughnut),
    { ssr: false }
);

/**
 * Portfolio
 * props:
 *  - portfolio: [{ tradingPair, market, valuation, ... }]
 *  - markets: optional array from getAllMarkets() (있으면 한글명을 우선 사용)
 *
 * KRW 항목은 항상 "원화(KRW)"로 표시합니다.
 */
export default function Portfolio({ portfolio = [], markets = [] }) {
    const list = Array.isArray(portfolio) ? portfolio : [];

    // chart.js 등록 (클라이언트 전용)
    const [chartReady, setChartReady] = useState(false);
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const ChartJS = await import("chart.js");
                ChartJS.Chart.register(ChartJS.ArcElement, ChartJS.Tooltip, ChartJS.Legend);
                if (mounted) setChartReady(true);
            } catch (e) {
                console.error("Failed to load chart.js:", e);
            }
        })();
        return () => { mounted = false; };
    }, []);

    // markets로부터 빠른 lookup 맵 (여러 키 변형 포함)
    const { nameByKey, nameBySymbol } = useMemo(() => {
        const byKey = new Map();
        const bySym = new Map();
        if (!Array.isArray(markets)) return { nameByKey: byKey, nameBySymbol: bySym };

        const norm = (s) => String(s ?? "").trim();
        for (const m of markets) {
            try {
                const key = norm(m.market ?? m.code ?? m.product_code ?? "");
                const sym = (key.includes("-") ? key.split("-")[1] : (m.symbol || m.marketSymbol || m.coinSymbol || "")).toString().toUpperCase();
                const name = m.korean_name ?? m.koreanName ?? m.korean ?? m.name ?? null;

                if (key) {
                    const up = key.toUpperCase();
                    byKey.set(up, name ?? byKey.get(up));
                    byKey.set(up.replace(/[-_\/\s]/g, ""), name ?? byKey.get(up.replace(/[-_\/\s]/g, "")));
                    byKey.set(up.replace(/\//g, "-"), name ?? byKey.get(up.replace(/\//g, "-")));
                }
                if (sym) bySym.set(sym, name ?? bySym.get(sym));
            } catch (e) {
                /* ignore malformed entry */
            }
        }
        return { nameByKey: byKey, nameBySymbol: bySym };
    }, [markets]);

    // unwrap helper: raw/_raw 처리
    const unwrap = (p) => {
        if (!p) return p;
        if (typeof p === "object") {
            if (p.raw && typeof p.raw === "object") return p.raw;
            if (p._raw && typeof p._raw === "object") return p._raw;
        }
        return p;
    };

    // 심볼 추출(여러 포맷 허용) - 대문자 반환
    const getSymbol = (p) => {
        const obj = unwrap(p) ?? p ?? {};
        if (!obj) return "";
        if (obj.coinSymbol) return String(obj.coinSymbol).trim().toUpperCase();

        const cand = String(obj.tradingPair ?? obj.market ?? obj.marketName ?? obj.code ?? obj.asset ?? "").trim();
        if (!cand) return "";
        if (cand.includes("-")) return cand.split("-")[1].toUpperCase();
        if (cand.includes("/")) return cand.split("/")[0].toUpperCase();
        const m = cand.match(/^([A-Z]{3})([A-Z0-9]+)$/i);
        if (m) return m[2].toUpperCase();
        return cand.toUpperCase();
    };

    // 문자열에서 연속된 한글만 추출
    const extractKorean = (s) => {
        if (!s || typeof s !== "string") return null;
        const matches = s.match(/[\u3131-\u318E\uAC00-\uD7A3\s]+/g);
        if (!matches) return null;
        return matches.join(" ").replace(/\s+/g, " ").trim();
    };

    // 한글명 찾기: 항목 자체 -> markets 맵(key/symbol) -> 문자열 스캔
    const getKoreanName = (p) => {
        const obj = unwrap(p) ?? p ?? {};
        // 1) 직접 필드 우선
        const direct = obj.korean_name ?? obj.koreanName ?? obj.korean ?? obj.name ?? obj.coinName ?? obj.displayName ?? null;
        if (direct) {
            const kr = extractKorean(String(direct));
            if (kr) return kr;
        }

        // 2) markets map lookup (여러 변형 시도)
        const rawKey = String(obj.market ?? obj.tradingPair ?? obj.marketName ?? obj.code ?? "").trim();
        if (rawKey) {
            const variants = [
                rawKey.toUpperCase(),
                rawKey.toUpperCase().replace(/[-_\/\s]/g, ""),
                rawKey.toUpperCase().replace(/\//g, "-"),
                rawKey.toUpperCase().replace(/-/g, "/"),
            ];
            for (const v of variants) {
                const nm = nameByKey.get(v);
                if (nm) {
                    const kr = extractKorean(String(nm));
                    return kr ?? String(nm).trim();
                }
            }
        }

        // 3) symbol 기반 lookup
        const sym = getSymbol(obj);
        if (sym) {
            const nm = nameBySymbol.get(sym);
            if (nm) {
                const kr = extractKorean(String(nm));
                return kr ?? String(nm).trim();
            }
        }

        // 4) 마지막 폴백: 필드 문자열에서 한글 추출
        const candidates = [obj.name, obj.displayName, obj.title, obj.market, obj.tradingPair].filter(Boolean).map(String);
        for (const c of candidates) {
            const kr = extractKorean(c);
            if (kr) return kr;
        }
        return null;
    };

    // 항상 "한글명(SYMBOL)" 형태 우선, 없으면 SYMBOL
    // 추가: KRW는 "원화(KRW)"로 고정
    const formatLabel = (p) => {
        const obj = unwrap(p) ?? p ?? {};
        const symbol = (getSymbol(obj) || "").toUpperCase();

        // KRW 특수 처리
        if (symbol === "KRW" || String(obj.market)?.toUpperCase() === "KRW") return "원화(KRW)";

        const kr = getKoreanName(obj);

        if (kr && /\([A-Za-z0-9]+\)$/.test(kr)) return kr;
        if (kr) return symbol ? `${kr} (${symbol})` : kr;
        if (symbol) return symbol;
        return String(obj.tradingPair ?? obj.market ?? obj.name ?? "Unknown");
    };

    const { labels, dataValues, total } = useMemo(() => {
        const lbls = list.map((p) => formatLabel(p));
        const vals = list.map((p) => Number(p.valuation ?? p.value ?? 0));
        const tot = vals.reduce((s, v) => s + v, 0);
        return { labels: lbls, dataValues: vals, total: tot };
    }, [list, nameByKey, nameBySymbol]);

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

    // palette & chart data
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
                        const pct = total ? ((val / total) * 100).toFixed(2) : "0.00";
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
                        <div key={String(p.tradingPair ?? p.market ?? idx)} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span style={{ background: bgColors[idx] }} className="h-3 w-3 rounded-full inline-block" />
                                <span className="font-medium">{formatLabel(p)}</span>
                            </div>
                            <div className="tabular-nums text-white/80">
                                {((Number(p.valuation ?? p.value ?? 0) / total) * 100).toFixed(1)}%
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}