import React, { useMemo, useState } from "react";

export default function Favorites({
                                      markets = [],
                                      favorites = [],
                                      tickers = {},
                                      onAddFavorite,
                                      loading = false,
                                  }) {
    const [query, setQuery] = useState("");
    const [selectedFromCombo, setSelectedFromCombo] = useState("");

    const cols = "1fr 220px 140px 140px";

    const normalizeMarketKey = (raw) => {
        if (!raw && raw !== 0) return "";
        let s = String(raw).trim().toUpperCase();
        s = s.replace(/\s+/g, "");
        if (s.includes("-")) return s;
        const match = s.match(/^([A-Z]{3})([A-Z0-9]+)$/);
        if (match) return `${match[1]}-${match[2]}`;
        return s;
    };

    const getTickerInfo = (marketRaw) => {
        const key = normalizeMarketKey(marketRaw);
        if (!key) return null;

        const candidates = [
            key,
            key.replace("-", ""),
            key.toLowerCase(),
            key.replace("-", "").toLowerCase(),
        ];

        let t;
        for (const k of candidates) {
            if (tickers?.[k] !== undefined) {
                t = tickers[k];
                break;
            }
        }

        if (!t) return null;

        const price = t.tradePrice ?? t.trade_price ?? null;
        const prevClose = t.prevClosingPrice ?? t.prev_closing_price ?? null;

        const change =
            price != null && prevClose != null
                ? price - prevClose
                : null;

        const changeRate =
            change != null && prevClose
                ? (change / prevClose) * 100
                : null;

        // ✅🔥 여기 중요: 무조건 24시간 거래대금만 사용
        const tradingValue =
            t.accTradePrice24h ??
            t.acc_trade_price_24h ??
            null;

        return {
            price,
            change,
            changeRate,
            tradingValue,
        };
    };

    const formatKRW = (n) => {
        const num = Number(n);
        if (!Number.isFinite(num)) return "-";
        return `${Math.round(num).toLocaleString()} KRW`;
    };

    // ✅ 백만 단위로 표시
    const formatTradingValue = (n) => {
        const num = Number(n);
        if (!Number.isFinite(num) || num === 0) return "-";
        return `${Math.round(num / 1_000_000).toLocaleString()}백만`;
    };

    const filtered = useMemo(() => {
        const q = (query || "").trim().toUpperCase();
        if (!q) return favorites;
        return favorites.filter((f) => {
            const market = (f.market || "").toUpperCase();
            const name = (f.korean_name || "").toUpperCase();
            return market.includes(q) || name.includes(q);
        });
    }, [favorites, query]);

    const handleAdd = async () => {
        const market = selectedFromCombo?.trim().toUpperCase();
        if (!market) return alert("코인을 선택하세요");
        await onAddFavorite(market);
        setSelectedFromCombo("");
    };

    return (
        <div className="max-w-4xl mx-auto space-y-4">

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
                <input
                    value={selectedFromCombo}
                    onChange={(e) => setSelectedFromCombo(e.target.value)}
                    placeholder="예: KRW-BTC"
                    className="px-3 py-2 rounded bg-white/10"
                />
                <button
                    onClick={handleAdd}
                    disabled={loading}
                    className="px-4 py-2 bg-indigo-600 rounded"
                >
                    추가
                </button>
            </div>

            <div
                className="grid items-center"
                style={{ gridTemplateColumns: cols, gap: "1rem" }}
            >
                <div>코인명</div>
                <div className="text-right">현재가</div>
                <div className="text-right">전일대비</div>
                <div className="text-right">거래대금(24H)</div>
            </div>

            {filtered.length === 0 ? (
                <div>관심 코인이 없습니다.</div>
            ) : (
                filtered.map((f, idx) => {
                    const ticker = getTickerInfo(f.market);
                    const price = ticker?.price;
                    const change = ticker?.change;
                    const changeRate = ticker?.changeRate;
                    const tradingValue = ticker?.tradingValue;

                    const changeColor =
                        change >= 0 ? "text-red-400" : "text-blue-400";

                    return (
                        <div key={`${f.market}-${idx}`} className="bg-[#0b0f1a]/70 p-3 rounded">
                            <div
                                className="grid items-center"
                                style={{ gridTemplateColumns: cols, gap: "1rem" }}
                            >
                                <div>
                                    {f.korean_name} ({f.market?.split("-")[1]})
                                </div>

                                <div className="text-right">
                                    {price != null ? formatKRW(price) : "-"}
                                </div>

                                <div className={`text-right ${changeColor}`}>
                                    {changeRate != null
                                        ? `${changeRate.toFixed(2)}%`
                                        : "-"}
                                </div>

                                <div className="text-right">
                                    {tradingValue != null
                                        ? formatTradingValue(tradingValue)
                                        : "-"}
                                </div>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}