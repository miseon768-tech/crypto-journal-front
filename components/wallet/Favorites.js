import React, { useEffect, useMemo, useState } from "react";

/**
 * Favorites (관심코인) - 검색(콤보박스)으로만 추가하도록 변경됨
 *
 * Props:
 * - markets: 거래쌍 목록 (자동완성/검색용)
 * - favorites: 관심코인 리스트 (서버 응답)
 * - favInput, setFavInput (이전 호환용, 이제 사용하지 않음)
 * - onAddFavorite(marketString)
 * - selectedFavIds, toggleSelectFavorite
 * - onDeleteSelectedFavorites, onDeleteAllFavorites, onDeleteSingle
 * - onQuickAdd(market)
 * - loading
 */
export default function Favorites({
                                      markets = [],
                                      favorites = [],
                                      favInput, // legacy - ignored
                                      setFavInput, // legacy - ignored
                                      onAddFavorite,
                                      selectedFavIds = new Set(),
                                      toggleSelectFavorite,
                                      onDeleteSelectedFavorites,
                                      onDeleteAllFavorites,
                                      onQuickAdd,
                                      onDeleteSingle,
                                      loading = false,
                                  }) {
    const [query, setQuery] = useState("");
    const [selectedFromCombo, setSelectedFromCombo] = useState(""); // e.g. "KRW-BTC"

    useEffect(() => {
        // 개발용 디버그: markets / favorites 전달 상태 확인
        console.debug("Favorites - markets length:", markets?.length, "favorites length:", favorites?.length);
    }, [markets, favorites]);

    // 여러 가능 필드에서 market 값을 안전하게 추출
    const extractMarket = (f) => {
        if (!f) return "";
        if (typeof f === "string") return f;
        if (f.market) return f.market;
        if (f.symbol) return f.symbol;
        if (f.code) return f.code;
        if (f.tradingPair && typeof f.tradingPair === "object") return f.tradingPair.market ?? f.tradingPair.symbol ?? "";
        if (f.tradingPairInfo && typeof f.tradingPairInfo === "object") return f.tradingPairInfo.market ?? "";
        return f.marketName ?? f.name ?? "";
    };
    const extractName = (f) => {
        if (!f) return "";
        if (f.name) return f.name;
        if (f.korean_name) return f.korean_name;
        if (f.english_name) return f.english_name;
        if (f.tradingPair && typeof f.tradingPair === "object") {
            return f.tradingPair.korean_name ?? f.tradingPair.english_name ?? f.tradingPair.name ?? "";
        }
        return "";
    };

    // 관심코인 내부 검색
    const filtered = useMemo(() => {
        const q = (query || "").trim().toUpperCase();
        if (!q) return favorites;
        return favorites.filter((f) => {
            const market = (extractMarket(f) || "").toString().toUpperCase();
            const name = (extractName(f) || "").toString().toUpperCase();
            return market.includes(q) || name.includes(q);
        });
    }, [favorites, query]);

    // comboMarkets: markets 우선, 비어있으면 favorites에서 후보 생성
    const comboMarkets = useMemo(() => {
        if (Array.isArray(markets) && markets.length > 0) {
            return markets;
        }
        // favorites 기반 후보 생성: { market, korean_name }
        if (!Array.isArray(favorites) || favorites.length === 0) return [];
        return favorites
            .map((f) => {
                const market = extractMarket(f);
                const korean_name = extractName(f) || market;
                return market ? { market, korean_name } : null;
            })
            .filter(Boolean);
    }, [markets, favorites]);

    // 추가: 콤보에서 선택된 마켓만 허용 (직접 입력 없음)
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
            {/* 콤보박스 (검색으로 선택) */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
                <MarketCombobox
                    markets={comboMarkets}
                    value={selectedFromCombo}
                    onChange={(m) => setSelectedFromCombo(m)}
                    placeholder="코인 검색 후 선택 (예: 비트코인, BTC)"
                    limit={12}
                />

                <div className="flex gap-2">
                    <button
                        onClick={handleAdd}
                        disabled={loading || !selectedFromCombo}
                        className="px-4 py-2 bg-indigo-600 rounded hover:brightness-110 disabled:opacity-50"
                    >
                        추가
                    </button>
                </div>
            </div>

            {/* 관심코인 검색(리스트 내부) */}
            <div className="flex items-center gap-2">
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="관심코인 검색 (시장명 또는 이름)"
                    className="flex-1 px-3 py-2 rounded bg-gray-800"
                />
                <div className="text-sm text-white/70">총 {favorites.length}개</div>
            </div>

            {/* 액션 버튼 */}
            <div className="flex gap-2">
                <button onClick={onDeleteSelectedFavorites} className="px-3 py-1 bg-white/5 rounded hover:bg-red-600 hover:text-white">선택 삭제</button>
                <button onClick={onDeleteAllFavorites} className="px-3 py-1 bg-white/5 rounded hover:bg-red-600 hover:text-white">전체 삭제</button>
            </div>

            {/* 리스트 */}
            <div className="grid gap-2">
                {filtered.length === 0 ? (
                    <div className="text-white/60">관심 코인이 없습니다.</div>
                ) : (
                    filtered.map((f) => {
                        const id = f.id ?? f._id ?? (f.tradingPair && f.tradingPair.id) ?? extractMarket(f) ?? JSON.stringify(f);
                        const market = extractMarket(f);
                        const name = extractName(f);
                        const checked = selectedFavIds.has(id);
                        return (
                            <div key={id} className="flex items-center justify-between bg-[#0b0f1a]/70 p-3 rounded">
                                <div className="flex items-center gap-3">
                                    <input type="checkbox" checked={checked} onChange={() => toggleSelectFavorite(id)} className="h-4 w-4" />
                                    <div>
                                        <div className="font-medium">{market}</div>
                                        {name && <div className="text-xs text-white/60">{name}</div>}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button onClick={() => onQuickAdd(market)} className="px-2 py-1 bg-white/5 rounded hover:bg-white/10">자산등록</button>
                                    <button onClick={async () => {
                                        if (!confirm(`${market}을(를) 관심 목록에서 삭제하시겠습니까?`)) return;
                                        try {
                                            await onDeleteSingle(id);
                                        } catch (err) {
                                            console.error("onDeleteSingle failed", err);
                                            alert("삭제 실패");
                                        }
                                    }} className="px-2 py-1 bg-white/5 rounded hover:bg-red-600 hover:text-white">삭제</button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

/* -------------------------
   MarketCombobox (MyCoins에 있는 것을 그대로 복사)
   ------------------------- */
function MarketCombobox({ markets = [], value = "", onChange = () => {}, placeholder = "코인 검색 (예: 비��코인, BTC)", limit = 12 }) {
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
    const label = (m) => `${m.korean_name || "알수없음"}(${toSymbol(m.market)})`;
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

    useEffect(() => {
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