// Favorites.jsx (수정본 — 부모에서 tickers prop 전달 필요)
import React, { useMemo, useState } from "react";

export default function Favorites({
                                      markets = [],
                                      favorites = [],
                                      tickers = {}, // <-- 부모에서 소켓으로 받은 tickers를 전달해야 함
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

    // 강화된 getTickerInfo: 다양한 필드/키를 시도해서 값을 뽑아냄
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

        // fallback: suffix/contains 검색
        if (!t) {
            const symbol = key.includes("-") ? key.split("-")[1] : key;
            if (symbol) {
                const lowerSym = String(symbol).toLowerCase();
                const entries = Object.entries(tickers || {});
                let match = entries.find(([k]) => {
                    const lk = String(k).toLowerCase();
                    return lk.endsWith(`-${lowerSym}`) || lk.endsWith(lowerSym);
                });
                if (!match) {
                    match = entries.find(([k]) => String(k).toLowerCase().includes(lowerSym));
                }
                if (match) t = match[1];
            }
        }

        if (!t) return null;

        // 다양한 네이밍 커버
        const price =
            t.tradePrice ??
            t.trade_price ??
            t.trade_price_krw ??
            t.price ??
            t.lastPrice ??
            t.tradePriceKRW ??
            null;

        const prevClose =
            t.prevClosingPrice ??
            t.prev_closing_price ??
            t.prevClose ??
            t.prev_close ??
            null;

        const change =
            t.changePrice ??
            t.change_price ??
            t.signedChangePrice ??
            (price != null && prevClose != null ? price - prevClose : null);

        const changeRate =
            t.changeRate ??
            t.change_rate ??
            t.signedChangeRate ??
            (change != null && prevClose ? (change / prevClose) * 100 : null);

        const tradingValue =
            t.accTradePrice24h ??
            t.acc_trade_price_24h ??
            t.accTradePrice ??
            t.acc_trade_price ??
            t.volume24h ??
            t.accTradeVolume24h ??
            t.acc_trade_volume_24h ??
            null;

        return {
            price: price ?? null,
            change: change ?? null,
            changeRate: changeRate ?? null,
            tradingValue: tradingValue ?? null,
        };
    };

    const formatKRW = (n) => {
        const num = Number(n);
        if (!Number.isFinite(num)) return "-";
        return `${Math.round(num).toLocaleString()} KRW`;
    };

    const formatTradingValue = (n) => {
        const num = Number(n);
        if (!Number.isFinite(num) || num === 0) return "-";
        return `${Math.round(num / 1_000_000).toLocaleString()}백만`;
    };

    // tickers가 바뀌면 재계산되도록 의존성에 tickers 추가
    const filtered = useMemo(() => {
        const q = (query || "").trim().toUpperCase();
        if (!q) return favorites;
        return favorites.filter((f) => {
            const market = (f.market || "").toUpperCase();
            const name = (f.korean_name || f.koreanName || "").toUpperCase();
            return market.includes(q) || name.includes(q);
        });
    }, [favorites, query, tickers, markets]);

    const handleAdd = async () => {
        const market = selectedFromCombo?.trim().toUpperCase();
        if (!market) return alert("코인을 선택하세요");
        await onAddFavorite?.(market);
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
                <button onClick={handleAdd} disabled={loading} className="px-4 py-2 bg-indigo-600 rounded">
                    추가
                </button>
            </div>

            <div className="grid items-center" style={{ gridTemplateColumns: cols, gap: "1rem" }}>
                <div>코인명</div>
                <div className="text-right">현재가</div>
                <div className="text-right">전일대비</div>
                <div className="text-right">거래대금</div>
            </div>

            {filtered.length === 0 ? (
                <div>관심 코인이 없습니다.</div>
            ) : (
                filtered.map((f, idx) => {
                    const marketKey = f.market ?? f.code ?? (f.tradingPair?.market ?? "");
                    const ticker = getTickerInfo(marketKey);
                    const price = ticker?.price;
                    const change = ticker?.change;
                    const changeRate = ticker?.changeRate;
                    const tradingValue = ticker?.tradingValue;

                    const changeColor = change == null ? "text-white/60" : change >= 0 ? "text-red-400" : "text-blue-400";

                    return (
                        <div key={`${f.market ?? f.id}-${idx}`} className="bg-[#0b0f1a]/70 p-3 rounded">
                            <div className="grid items-center" style={{ gridTemplateColumns: cols, gap: "1rem" }}>
                                <div>
                                    {f.korean_name ?? f.koreanName ?? f.name} ({(f.market ?? "").split("-")[1] ?? ""})
                                </div>

                                <div className="text-right">
                                    {price != null ? formatKRW(price) : "-"}
                                </div>

                                <div className={`text-right ${changeColor}`}>
                                    {changeRate != null ? `${changeRate.toFixed(2)}%` : "-"}
                                </div>

                                <div className="text-right">{tradingValue != null ? formatTradingValue(tradingValue) : "-"}</div>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}