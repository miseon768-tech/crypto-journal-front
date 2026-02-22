import React, { useMemo, useState } from "react";

/**
 * Favorites (관심코인)
 * - Header과 Row에 동일한 gridTemplateColumns(cols)을 적용해 간격(정렬)을 고정합니다.
 * - cols 값을 조정하면 전체 열 너비가 바뀝니다 (desktop 기준).
 * - WalletComponent에서 markets, favorites, tickers를 전달해야 합니다.
 */

export default function Favorites({
                                      markets = [],
                                      favorites = [],
                                      tickers = {},
                                      onAddFavorite,
                                      selectedFavIds = new Set(),
                                      toggleSelectFavorite = () => {},
                                      onDeleteSelectedFavorites = () => {},
                                      onDeleteAllFavorites = () => {},
                                      onQuickAdd = () => {},
                                      onDeleteSingle = async () => {},
                                      loading = false,
                                  }) {
    const [query, setQuery] = useState("");
    const [selectedFromCombo, setSelectedFromCombo] = useState("");

    // 그리드 컬럼: [코인명 | 현재가 | 전일대비 | 거래대금]
    // 이미지(6) 스타일에 가깝게 기본값 설정했습니다.
    // 원하시면 숫자(픽셀)를 조정해 주세요.
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

    const findMarketMetaById = (id) => {
        if (id === undefined || id === null) return null;
        const sid = String(id);
        return (markets || []).find((m) =>
            [m.id, m._id, m.tradingPairId, m.trading_pair_id, m.marketId, m.market_id]
                .map((x) => (x === undefined || x === null ? "" : String(x)))
                .some((v) => v === sid)
        ) ?? null;
    };

    const extractMarketFromFavorite = (f) => {
        if (!f) return "";
        if (typeof f === "string") return f;
        if (f.market) return f.market;
        if (f.symbol) return f.symbol;
        if (f.code) return f.code;

        const ids = [
            f.trading_pair_id,
            f.tradingPairId,
            f.tradingPair?.id,
            f.tradingPair?._id,
            f.id,
        ].filter((x) => x !== undefined && x !== null);

        if (ids.length > 0 && Array.isArray(markets) && markets.length > 0) {
            for (const pid of ids) {
                const meta = findMarketMetaById(pid);
                if (meta) return meta.market ?? meta.code ?? meta.symbol ?? "";
            }
        }

        if (f.tradingPair && typeof f.tradingPair === "object") {
            return f.tradingPair.market ?? f.tradingPair.symbol ?? "";
        }
        if (f.trading_pair && typeof f.trading_pair === "object") {
            return f.trading_pair.market ?? f.trading_pair.symbol ?? "";
        }

        return f.marketName ?? f.name ?? f.korean_name ?? "";
    };

    const extractDisplayName = (f) => {
        if (!f) return "";
        const ids = [
            f.trading_pair_id,
            f.tradingPairId,
            f.tradingPair?.id,
            f.tradingPair?._id,
            f.id,
        ].filter((x) => x !== undefined && x !== null);

        if (ids.length > 0 && Array.isArray(markets) && markets.length > 0) {
            for (const pid of ids) {
                const meta = findMarketMetaById(pid);
                if (meta) return meta.korean_name ?? meta.koreanName ?? meta.name ?? "";
            }
        }

        if (f.tradingPair && typeof f.tradingPair === "object") {
            return f.tradingPair.korean_name ?? f.tradingPair.english_name ?? f.tradingPair.name ?? f.name ?? "";
        }

        return f.korean_name ?? f.koreanName ?? f.name ?? "";
    };

    const findMarketMeta = (marketRaw) => {
        if (!marketRaw) return null;
        const key = normalizeMarketKey(marketRaw);
        return (markets || []).find((m) => {
            const mm = normalizeMarketKey(m.market ?? m.code ?? m.symbol ?? "");
            return mm === key;
        }) ?? null;
    };

    const getTickerInfo = (marketRaw) => {
        const key = normalizeMarketKey(marketRaw);
        if (!key) return null;

        const candidates = [key, key.replace("-", ""), key.toLowerCase(), key.replace("-", "").toLowerCase()];
        let t;
        for (const k of candidates) {
            if (tickers?.[k] !== undefined) {
                t = tickers[k];
                break;
            }
        }

        if (t === undefined && Array.isArray(markets) && markets.length > 0) {
            const symbol = key.includes("-") ? key.split("-")[1] : key;
            const found = markets.find((m) => {
                const mKey = normalizeMarketKey(m.market ?? m.code ?? m.symbol ?? "");
                return mKey.split("-").pop() === symbol;
            });
            if (found) {
                const mk = normalizeMarketKey(found.market ?? found.code ?? found.symbol ?? "");
                t = tickers?.[mk] ?? tickers?.[mk.replace("-", "")];
            }
        }

        if (t === undefined || t === null) return null;
        if (typeof t === "number") return { price: t };

        const price = t.price ?? t.tradePrice ?? t.lastPrice ?? t.trade_price ?? t.close ?? null;
        const prevClose = t.prevClose ?? t.prev_close ?? t.open ?? t.yesterdayPrice ?? null;
        const change = t.change ?? t.diff ?? (price != null && prevClose != null ? price - prevClose : null);
        const changeRate = t.changeRate ?? t.change_rate ?? t.percent ?? (change != null && prevClose ? (change / prevClose) * 100 : null);
        const volume = t.volume ?? t.accTradeVolume ?? t.acc_trade_volume ?? t.acc_volume_24h ?? t.tradeVolume ?? t.volume24h ?? null;

        return { price: price ?? null, prevClose: prevClose ?? null, change: change ?? null, changeRate: changeRate ?? null, volume: volume ?? null };
    };

    const formatKRW = (n) => {
        const num = Number(n);
        if (!Number.isFinite(num)) return "-";
        return `${Math.round(num).toLocaleString()} KRW`;
    };
    const formatTradingValue = (n) => {
        const num = Number(n);
        if (!Number.isFinite(num) || num === 0) return "-";
        if (Math.abs(num) >= 1e8) return `${Math.round(num / 1e8).toLocaleString()}억`;
        if (Math.abs(num) >= 1e4) return `${Math.round(num / 1e4).toLocaleString()}만`;
        return `${Math.round(num).toLocaleString()}`;
    };

    const filtered = useMemo(() => {
        const q = (query || "").trim().toUpperCase();
        if (!q) return favorites;
        return favorites.filter((f) => {
            const market = (extractMarketFromFavorite(f) || "").toString().toUpperCase();
            const name = (extractDisplayName(f) || "").toString().toUpperCase();
            return market.includes(q) || name.includes(q);
        });
    }, [favorites, query, markets]);

    const comboMarkets = useMemo(() => {
        if (Array.isArray(markets) && markets.length > 0) return markets;
        if (!Array.isArray(favorites) || favorites.length === 0) return [];
        return favorites
            .map((f) => {
                const market = extractMarketFromFavorite(f);
                const korean_name = extractDisplayName(f) || market;
                return market ? { market, korean_name } : null;
            })
            .filter(Boolean);
    }, [markets, favorites]);

    const handleAdd = async () => {
        const market = (selectedFromCombo || "").toString().trim().toUpperCase();
        if (!market) return alert("콤보에서 코인을 선택해주세요 (예: KRW-BTC)");
        if (typeof onAddFavorite === "function") {
            try {
                await onAddFavorite(market);
                setSelectedFromCombo("");
            } catch (err) {
                console.error("관심코인 추가 실패", err);
                alert(err?.message || "관심코인 추가 실패");
            }
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-4">
            {/* 콤보 + 추가 */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
                <MarketCombobox markets={comboMarkets} value={selectedFromCombo} onChange={(m) => setSelectedFromCombo(m)} placeholder="코인 검색 후 선택 (예: 비트코인, BTC)" limit={12} />
                <div className="flex gap-2">
                    <button onClick={handleAdd} disabled={loading || !selectedFromCombo} className="px-4 py-2 bg-indigo-600 rounded hover:brightness-110 disabled:opacity-50">추가</button>
                </div>
            </div>

            {/* 검색 및 액션 */}
            <div className="flex items-center gap-2">
            </div>

            <div className="flex gap-2">

            </div>

            {/* Header: '선택 삭제 / 전체 삭제' 바로 아래에 위치, 동일한 cols 사용 */}
            <div className="px-1">
                <div className="grid items-center" style={{ gridTemplateColumns: cols, gap: "1rem" }}>
                    <div className="text-sm text-white/60 font-semibold">코인명</div>
                    <div className="text-sm text-white/60 font-semibold text-right">현재가</div>
                    <div className="text-sm text-white/60 font-semibold text-right">전일대비</div>
                    <div className="text-sm text-white/60 font-semibold text-right">거래대금</div>
                </div>
            </div>

            {/* 리스트 */}
            <div className="grid gap-2">
                {filtered.length === 0 ? (
                    <div className="text-white/60">관심 코인이 없습니다.</div>
                ) : (
                    filtered.map((f, idx) => {
                        const marketRaw = extractMarketFromFavorite(f);
                        const marketKey = normalizeMarketKey(marketRaw);
                        const meta = findMarketMeta(marketRaw);
                        const displayName = meta?.korean_name ?? extractDisplayName(f) ?? "";
                        const symbol = marketKey.includes("-") ? marketKey.split("-")[1] : meta?.symbol ?? meta?.code ?? "";
                        const ticker = getTickerInfo(marketRaw);

                        const price = ticker?.price ?? null;
                        const change = ticker?.change ?? null;
                        const changeRate = ticker?.changeRate ?? null;
                        const volume = ticker?.volume ?? null;
                        const changeColor = change >= 0 ? "text-red-400" : "text-blue-400";

                        return (
                            <div key={idx} className="bg-[#0b0f1a]/70 p-3 rounded">
                                <div className="grid items-center" style={{ gridTemplateColumns: cols, gap: "1rem" }}>
                                    <div>
                                        <div className="font-medium">{displayName ? `${displayName} (${symbol})` : (marketKey || symbol)}</div>
                                    </div>

                                    <div className="text-right">
                                        <div className="text-base font-semibold tabular-nums">{price !== null ? formatKRW(price) : "-"}</div>
                                    </div>

                                    <div className="text-right">
                                        <div className={`text-sm ${changeColor}`}>{change !== null ? `${changeRate !== null ? changeRate.toFixed(2) + "%" : "-"} ` : "-"}</div>
                                        <div className="text-xs text-white/60">{change !== null ? `${formatKRW(change)}` : ""}</div>
                                    </div>

                                    <div className="text-right">
                                        <div className="text-base font-semibold tabular-nums">{volume !== null ? formatTradingValue(volume) : "-"}</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

/* MarketCombobox (간단 재사용) */
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
                const kor = normalize(m.korean_name ?? m.koreanName ?? m.korean ?? "");
                const eng = normalize(m.english_name ?? m.englishName ?? "");
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
    const label = (m) => `${m.korean_name || m.koreanName || "알수없음"} (${toSymbol(m.market)})`;
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