import React, { useMemo, useState } from "react";

/* MarketCombobox (inline, 레이아웃/모양은 그대로 유지) */
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
   Favorites component (모양 유지, 데이터 파싱/부호 처리만 강화)
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

    // 개선된 파서: 부호 결정 우선순위(price-prev -> change string -> provider signed) 및 rate normalization
    const getTickerInfoFromPayload = (t) => {
        if (!t) return null;

        // 가격 관련
        const price = asNumber(t.tradePrice ?? t.trade_price ?? t.price ?? t.lastPrice ?? t.close);
        const prev = asNumber(t.prevClosingPrice ?? t.prev_closing_price ?? t.prevClose ?? t.prev_close ?? t.open);

        // provider가 줄 수 있는 값들
        const rawSigned = asNumber(t.signedChangePrice ?? t.signed_change_price ?? t.signedChange ?? t.signed_change);
        const rawAbsChange = asNumber(t.changePrice ?? t.change_price ?? t.change ?? t.change_amount);

        // 1) 가능하면 price - prev 로 정확한 signed change 계산 (우선)
        const computedChange = (price != null && prev != null) ? (price - prev) : null;

        // 2) 문자열 필드로 방향 읽기 (RISE/FALL/UP/DOWN 등)
        const changeStr = (t.change ?? t.change_type ?? t.change_flag ?? t.askBid ?? "").toString().toUpperCase();
        let isPositive = null;
        if (computedChange != null) {
            isPositive = computedChange > 0 ? true : (computedChange < 0 ? false : null);
        } else if (changeStr) {
            if (changeStr.includes("RISE") || changeStr.includes("UP") || changeStr.includes("PLUS") || changeStr.includes("BUY")) isPositive = true;
            else if (changeStr.includes("FALL") || changeStr.includes("DOWN") || changeStr.includes("MINUS") || changeStr.includes("SELL")) isPositive = false;
        }

        // 3) 최종 signed change 결정: computed > provider signed > abs
        let signedChange = null;
        if (computedChange != null) {
            signedChange = computedChange;
        } else if (rawSigned != null) {
            if (isPositive === true) signedChange = Math.abs(rawSigned);
            else if (isPositive === false) signedChange = -Math.abs(rawSigned);
            else signedChange = rawSigned;
        } else if (rawAbsChange != null) {
            if (isPositive === true) signedChange = Math.abs(rawAbsChange);
            else if (isPositive === false) signedChange = -Math.abs(rawAbsChange);
            else signedChange = rawAbsChange;
        } else {
            signedChange = null;
        }

        // changeRate 정규화: provider가 ratio(0.0004)로 보내면 *100 해서 percent로 바꿈. 부호는 isPositive 기준 보정.
        let rawRate = asNumber(t.changeRate ?? t.change_rate ?? t.signedChangeRate ?? t.signed_change_rate ?? t.percent ?? t.percent_change);
        let changeRatePct = null;
        if (rawRate != null) {
            changeRatePct = Math.abs(rawRate) < 1 ? rawRate * 100 : rawRate;
            if (isPositive === true) changeRatePct = Math.abs(changeRatePct);
            else if (isPositive === false) changeRatePct = -Math.abs(changeRatePct);
        } else if (signedChange != null && prev != null && prev !== 0) {
            changeRatePct = (signedChange / prev) * 100;
        }

        // tradingValue: 우선 accTradePrice24h -> accTradePrice -> accTradeVolume24h * price -> tradeVolume * price
        let tradingValue = asNumber(
            t.accTradePrice24h ??
            t.acc_trade_price_24h ??
            t.accTradePrice ??
            t.acc_trade_price ??
            t.acc_trade_value_24h ??
            t.accTradeValue24h
        );

        if ((tradingValue == null || tradingValue === 0) && (t.accTradeVolume24h || t.acc_trade_volume_24h || t.accTradeVolume || t.acc_trade_volume)) {
            const vol = asNumber(t.accTradeVolume24h ?? t.acc_trade_volume_24h ?? t.accTradeVolume ?? t.acc_trade_volume);
            if (vol != null && price != null) tradingValue = vol * price;
        }

        if ((tradingValue == null || tradingValue === 0) && (t.tradeVolume || t.trade_volume) && price != null) {
            const rv = asNumber(t.tradeVolume ?? t.trade_volume);
            if (rv != null) tradingValue = rv * price;
        }

        return {
            price: price ?? null,
            change: signedChange ?? null, // signed value (positive => up)
            changeRate: changeRatePct ?? null, // percent with sign
            tradingValue: tradingValue ?? null, // KRW
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

    // tickers map에서 마켓에 맞는 raw payload 또는 숫자를 찾아 정규화된 info 반환
    const getTickerInfo = (marketRaw) => {
        const key = normalizeMarketKey(marketRaw);
        if (!key) return null;

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

        if (typeof raw === "number") {
            const price = asNumber(raw);
            return { price: price ?? null, change: null, changeRate: null, tradingValue: null };
        }

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

                    // 색상/부호는 change (signed) 기준으로 판단 — 모양은 그대로 유지
                    const changeColor = change == null ? "text-white/60" : change >= 0 ? "text-red-400" : "text-blue-400";
                    const displayRate = changeRate != null ? `${changeRate >= 0 ? "+" : ""}${changeRate.toFixed(2)}%` : "-";

                    return (
                        <div key={`${f.market ?? f.id}-${idx}`} className="bg-[#0b0f1a]/70 p-3 rounded">
                            <div className="grid items-center" style={{ gridTemplateColumns: cols, gap: "1rem" }}>
                                <div>
                                    {f.korean_name ?? f.koreanName ?? f.name} ({(f.market ?? "").split("-")[1] ?? ""})
                                </div>

                                <div className="text-right">{price != null ? formatKRW(price) : "-"}</div>

                                <div className={`text-right ${changeColor}`}>{displayRate}</div>

                                <div className="text-right">{tradingValue != null ? formatTradingValue(tradingValue) : "-"}</div>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}