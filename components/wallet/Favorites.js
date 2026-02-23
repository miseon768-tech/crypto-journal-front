import React, { useMemo, useState } from "react";

/**
 * Favorites.jsx
 * - 입력창은 MarketCombobox (MyCoins와 동일 방식)으로 변경한 채,
 *   현재가 / 전일대비 / 거래대금 추출 로직은 강화된 버전으로 복구했습니다.
 *
 * - 부모에서 전달해야 할 props:
 *   markets, favorites, tickers, onAddFavorite, loading
 *
 * 변경 요약:
 * - MarketCombobox: 입력창 대체 (자동완성)
 * - getTickerInfo: asNumber + getTickerInfoFromPayload를 사용하여 다양한 필드명과 문자열/숫자 타입 모두 대응
 */

/* -------------------------
   MarketCombobox (inline)
------------------------- */
function MarketCombobox({ markets = [], value = "", onChange = () => {}, placeholder = "코인 검색 (예: 비트코인, BTC)", limit = 12 }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");

    const normalize = (s) => String(s || "").trim().toLowerCase();
    const toSymbol = (market) => {
        const m = String(market || "");
        return m.includes("-") ? m.split("-")[1] : m;
    };

    const selected = useMemo(() => {
        if (!value) return null;
        return (markets || []).find((m) => m.market === value) || null;
    }, [markets, value]);

    const scored = useMemo(() => {
        const queryRaw = q.trim();
        const query = normalize(queryRaw);
        const base = markets || [];
        if (!query) return base.slice(0, limit).map((m) => ({ m, score: 0 }));

        const isSymbolOnly = /^[a-z0-9]{2,10}$/i.test(queryRaw);

        const results = base
            .map((m) => {
                const market = normalize(m.market);
                const kor = normalize(m.korean_name ?? m.koreanName ?? "");
                const eng = normalize(m.english_name ?? "");
                const symbol = normalize(toSymbol(m.market));
                let score = 0;
                if (isSymbolOnly && symbol === query) score += 950;
                if (market === query) score += 1000;
                if (market.includes(query)) score += 200;
                if (symbol.includes(query)) score += 180;
                if (kor.includes(query)) score += 160;
                if (eng.includes(query)) score += 140;
                return { m, score };
            })
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        return results;
    }, [markets, q, limit]);

    const candidates = scored.map((x) => x.m);
    const label = (m) => `${m.korean_name ?? m.koreanName ?? "알수없음"}(${toSymbol(m.market)})`;
    const displayValue = open ? q : selected ? label(selected) : value || "";

    const pick = (m) => {
        onChange(m.market);
        setQ("");
        setOpen(false);
    };

    const onKeyDown = (e) => {
        if (e.key === "Enter") {
            if (candidates.length === 1) {
                e.preventDefault();
                pick(candidates[0]);
            }
        }
        if (e.key === "Escape") setOpen(false);
    };

    React.useEffect(() => {
        if (!open) setQ("");
    }, [value, open]);

    return (
        <div className="relative">
            <input
                value={displayValue}
                onChange={(e) => {
                    setQ(e.target.value);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                className="w-full px-3 py-2 rounded bg-white/10"
                autoComplete="off"
            />

            {open && (
                <>
                    <div className="absolute z-20 mt-2 w-full rounded-xl border border-white/10 bg-[#0b0f1a] overflow-hidden">
                        <div className="max-h-72 overflow-auto">
                            {q.trim() && candidates.length === 0 ? (
                                <div className="px-3 py-2 text-sm text-white/60">검색 결과 없음</div>
                            ) : (
                                candidates.map((m) => (
                                    <button type="button" key={m.market} onClick={() => pick(m)} className="w-full px-3 py-2 text-left hover:bg-white/5">
                                        <div className="text-sm font-semibold">{label(m)}</div>
                                    </button>
                                ))
                            )}
                        </div>

                        <div className="px-3 py-2 text-[11px] text-white/40 border-t border-white/10">
                            {candidates.length === 1 ? "Enter로 자동 선택" : "클릭해서 선택"}
                        </div>
                    </div>

                    <button type="button" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} aria-label="close" />
                </>
            )}
        </div>
    );
}

/* -------------------------
   Favorites component
------------------------- */
export default function Favorites({
                                      markets = [],
                                      favorites = [],
                                      tickers = {}, // parent must pass socket payload map or price map
                                      onAddFavorite,
                                      loading = false,
                                  }) {
    const [query, setQuery] = useState("");
    const [selectedFromCombo, setSelectedFromCombo] = useState("");

    const cols = "1fr 220px 140px 140px";

    // 숫자 변환 유틸 (문자열/숫자/통화기호 대응)
    const asNumber = (v) => {
        if (v == null) return null;
        if (typeof v === "number" && Number.isFinite(v)) return v;
        const s = String(v).replace(/[,₩\s]/g, "").trim();
        if (s === "" || s === "-") return null;
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
    };

    // payload에서 price / prev / change / changeRate / tradingValue 추출
    const getTickerInfoFromPayload = (t) => {
        if (!t) return null;

        const price = asNumber(t.tradePrice ?? t.trade_price ?? t.price ?? t.lastPrice ?? t.close);
        const prev = asNumber(t.prevClosingPrice ?? t.prev_closing_price ?? t.prevClose ?? t.prev_close ?? t.open);

        let change = asNumber(t.changePrice ?? t.change_price ?? t.signedChangePrice ?? t.diff ?? t.delta);
        if (change == null && price != null && prev != null) change = price - prev;

        let changeRate = asNumber(t.changeRate ?? t.change_rate ?? t.signedChangeRate ?? t.percent ?? t.percent_change);
        if ((changeRate == null || changeRate === 0) && change != null && prev != null && prev !== 0) {
            changeRate = (change / prev) * 100;
        }

        let tradingValue = asNumber(
            t.accTradePrice24h ??
            t.acc_trade_price_24h ??
            t.accTradePrice ??
            t.acc_trade_price ??
            t.accTradeVolume24h ??
            t.acc_trade_volume_24h ??
            t.volume24h ??
            t.tradeVolume ??
            t.trade_volume
        );

        return {
            price: price ?? null,
            change: change ?? null,
            changeRate: changeRate ?? null,
            tradingValue: tradingValue ?? null,
        };
    };

    const normalizeMarketKey = (raw) => {
        if (!raw && raw !== 0) return "";
        let s = String(raw).trim().toUpperCase();
        s = s.replace(/\s+/g, "");
        if (s.includes("-")) return s;
        const m = s.match(/^([A-Z]{3})([A-Z0-9]+)$/);
        if (m) return `${m[1]}-${m[2]}`;
        return s;
    };

    // 메인: tickers map에서 마켓에 맞는 raw payload 또는 숫자를 찾아 정규화된 info 반환
    const getTickerInfo = (marketRaw) => {
        const key = normalizeMarketKey(marketRaw);
        if (!key) return null;

        // 후보 키들
        const candidates = [
            key,
            key.replace("-", ""),
            key.toLowerCase(),
            key.replace("-", "").toLowerCase(),
        ];

        let raw = null;
        for (const k of candidates) {
            if (tickers?.[k] !== undefined) {
                raw = tickers[k];
                break;
            }
        }

        // fallback: suffix/contains 탐색
        if (!raw) {
            const symbol = key.includes("-") ? key.split("-")[1] : key;
            if (symbol) {
                const lowerSym = String(symbol).toLowerCase();
                const entries = Object.entries(tickers || {});
                let match = entries.find(([k]) => {
                    const lk = String(k).toLowerCase();
                    return lk.endsWith(`-${lowerSym}`) || lk.endsWith(lowerSym);
                });
                if (!match) match = entries.find(([k]) => String(k).toLowerCase().includes(lowerSym));
                if (match) raw = match[1];
            }
        }

        if (raw == null) return null;

        // raw가 숫자면 price로 간주
        if (typeof raw === "number") {
            const price = asNumber(raw);
            return { price: price ?? null, change: null, changeRate: null, tradingValue: null };
        }

        // 객체(업비트 TickerResponse / TradeResponse 등)
        return getTickerInfoFromPayload(raw);
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
        try {
            await onAddFavorite?.(market);
            setSelectedFromCombo("");
        } catch (err) {
            console.error("onAddFavorite error:", err);
            alert("관심코인 추가에 실패했습니다.");
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-4">
            {/* 입력: MarketCombobox */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
                <MarketCombobox
                    markets={markets}
                    value={selectedFromCombo}
                    onChange={(m) => setSelectedFromCombo(m)}
                    placeholder="예: KRW-BTC"
                    limit={12}
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
                    const ticker = getTickerInfo(f.market);
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

                                <div className="text-right">{price != null ? formatKRW(price) : "-"}</div>

                                <div className={`text-right ${changeColor}`}>{changeRate != null ? `${changeRate.toFixed(2)}%` : "-"}</div>

                                <div className="text-right">{tradingValue != null ? formatTradingValue(tradingValue) : "-"}</div>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}