import React, {useMemo, useState, useEffect} from "react";

/* MarketCombobox (inline, 기존 코드 유지) */
function MarketCombobox({
                            markets = [], value = "", onChange = () => {
    }, placeholder = "코인 검색 (예: 비트코인, BTC)", limit = 12
                        }) {
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
        if (!query) return base.slice(0, limit).map((m) => ({m, score: 0}));

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
                return {m, score};
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
                    <div
                        className="absolute z-20 mt-2 w-full rounded-xl border border-white/10 bg-[#0b0f1a] overflow-hidden">
                        <div className="max-h-72 overflow-auto">
                            {q.trim() && candidates.length === 0 ? (
                                <div className="px-3 py-2 text-sm text-white/60">검색 결과 없음</div>
                            ) : (
                                candidates.map((m) => (
                                    <button type="button" key={m.market} onClick={() => pick(m)}
                                            className="w-full px-3 py-2 text-left hover:bg-white/5">
                                        <div className="text-sm font-semibold">{label(m)}</div>
                                    </button>
                                ))
                            )}
                        </div>

                        <div className="px-3 py-2 text-[11px] text-white/40 border-t border-white/10">
                            {candidates.length === 1 ? "Enter로 자동 선택" : "클릭해서 선택"}
                        </div>
                    </div>

                    <button type="button" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)}
                            aria-label="close"/>
                </>
            )}
        </div>
    );
}

/* -------------------------
   Favorites component (체크박스 + 전체선택 + 선택삭제 버튼)
   - 삭제 버튼 겹침 문제 해결: 절대 위치 제거하고 리스트 아래에 오른쪽 정렬 버튼 배치
   - 추가 버튼/선택 삭제 버튼에 hover 색상 변경 & transition 추가
------------------------- */
export default function Favorites({
                                      markets = [],
                                      favorites = [],
                                      tickers = {},
                                      onAddFavorite,
                                      onDeleteSelected, // (ids: string[]) => Promise<void>
                                      loading = false,
                                  }) {
    const [query, setQuery] = useState("");
    const [selectedFromCombo, setSelectedFromCombo] = useState("");
    const [selectedIds, setSelectedIds] = useState(() => new Set());

    useEffect(() => {
        // favorites가 바뀌면 선택 초기화
        setSelectedIds(new Set());
    }, [favorites]);

    const cols = "1fr 220px 140px 140px";

    const asNumber = (v) => {
        if (v == null) return null;
        if (typeof v === "number" && Number.isFinite(v)) return v;
        const s = String(v).replace(/[,₩\s]/g, "").trim();
        if (s === "" || s === "-") return null;
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
    };

    const formatTradingValue = (n) => {
        const num = Number(n);
        if (!Number.isFinite(num) || num === 0) return "-";
        const millions = Math.round(num / 1_000_000);
        return `${millions.toLocaleString()}백만`;
    };

    // payload parsing helpers (기존 로직 재사용)
    const extractPayloadObject = (raw) => {
        if (raw == null) return null;
        if (typeof raw === "object") {
            if (raw.raw && typeof raw.raw === "object") return raw.raw;
            if (raw._raw && typeof raw._raw === "object") return raw._raw;
            return raw;
        }
        if (typeof raw === "string") {
            let s = raw.trim();
            try {
                if (s.startsWith('a[')) {
                    const arr = JSON.parse(s);
                    if (Array.isArray(arr) && arr.length > 0) s = arr[0];
                }
            } catch (e) {
            }
            const first = s.indexOf('{');
            const last = s.lastIndexOf('}');
            if (first !== -1 && last !== -1 && last > first) {
                try {
                    const jsonText = s.substring(first, last + 1);
                    const obj = JSON.parse(jsonText);
                    if (obj.raw && typeof obj.raw === "object") return obj.raw;
                    return obj;
                } catch (e) {
                    return null;
                }
            }
        }
        return null;
    };

    const getAccPrice24h = (t) => {
        if (!t) return null;
        const candidatesToCheck = [];
        candidatesToCheck.push(t.acc_trade_price_24h, t.accTradePrice24h, t.acc_trade_price, t.accTradePrice, t.acc_trade_value_24h, t.accTradeValue24h, t.acc_trade_value, t.accTradeValue);
        const nestedKeys = ['raw', '_raw', 'payload', 'data'];
        nestedKeys.forEach(k => {
            if (t[k] && typeof t[k] === "object") {
                candidatesToCheck.push(t[k].acc_trade_price_24h, t[k].accTradePrice24h, t[k].acc_trade_price, t[k].accTradePrice, t[k].acc_trade_value_24h, t[k].accTradeValue24h);
            }
        });
        try {
            Object.entries(t).forEach(([k, v]) => {
                if (!k || v == null) return;
                const lk = String(k).toLowerCase();
                if (/acc|trade|value|price/.test(lk)) candidatesToCheck.push(v);
            });
        } catch (e) {
        }
        const nums = candidatesToCheck
            .map(asNumber)
            .filter(v => v != null && Number.isFinite(v) && v > 0);
        if (nums.length === 0) return null;
        return Math.max(...nums);
    };

    const getTickerInfoFromPayload = (tRaw) => {
        const t = extractPayloadObject(tRaw) ?? tRaw;
        if (!t || typeof t !== "object") return null;
        const price = asNumber(t.tradePrice ?? t.trade_price ?? t.price ?? t.lastPrice ?? t.close);
        const prev = asNumber(t.prevClosingPrice ?? t.prev_closing_price ?? t.prevClose ?? t.prev_close ?? t.open);
        const rawSigned = asNumber(t.signedChangePrice ?? t.signed_change_price ?? t.signedChange ?? t.signed_change);
        const rawAbsChange = asNumber(t.changePrice ?? t.change_price ?? t.change ?? t.change_amount);
        const changeStr = (t.change ?? t.change_type ?? t.change_flag ?? t.askBid ?? t.ask_bid ?? "").toString().toUpperCase();
        let dir = null;
        if (changeStr) {
            if (changeStr.includes("RISE") || changeStr.includes("UP") || changeStr.includes("PLUS") || changeStr.includes("BUY")) dir = "UP";
            else if (changeStr.includes("FALL") || changeStr.includes("DOWN") || changeStr.includes("MINUS") || changeStr.includes("SELL")) dir = "DOWN";
        }
        const computedChange = (price != null && prev != null) ? (prev - price) : null;
        let signedChange = null;
        if (computedChange != null) signedChange = computedChange;
        else if (rawSigned != null) {
            if (rawSigned < 0) signedChange = rawSigned;
            else if (dir === "DOWN") signedChange = -Math.abs(rawSigned);
            else signedChange = rawSigned;
        } else if (rawAbsChange != null) {
            if (dir === "DOWN") signedChange = -Math.abs(rawAbsChange);
            else if (dir === "UP") signedChange = Math.abs(rawAbsChange);
            else signedChange = rawAbsChange;
        } else signedChange = null;
        let rawRate = asNumber(t.changeRate ?? t.change_rate ?? t.signedChangeRate ?? t.signed_change_rate ?? t.percent ?? t.percent_change);
        let changeRatePct = null;
        if (rawRate != null) {
            changeRatePct = Math.abs(rawRate) < 1 ? rawRate * 100 : rawRate;
            if (rawRate > 0) changeRatePct = Math.abs(changeRatePct);
            else if (rawRate < 0) changeRatePct = -Math.abs(changeRatePct);
            else if (signedChange != null && prev != null && prev !== 0) changeRatePct = (signedChange / prev) * 100;
        } else if (signedChange != null && prev != null && prev !== 0) {
            changeRatePct = (signedChange / prev) * 100;
        }
        const marketKeyFromPayload = String(t.market ?? t.code ?? t.marketCode ?? t.product_code ?? t.symbol ?? t.marketName ?? "").toUpperCase();
        let baseCurrency = "";
        if (marketKeyFromPayload.includes("-")) baseCurrency = marketKeyFromPayload.split("-")[0];
        else {
            if (marketKeyFromPayload.startsWith("KRW") || marketKeyFromPayload.endsWith("KRW")) baseCurrency = "KRW";
        }
        const isKRWMarket = baseCurrency === "KRW";
        let accPrice24h = null;
        if (isKRWMarket) {
            accPrice24h = getAccPrice24h(t);
        }
        return {
            price: price ?? null,
            change: signedChange ?? null,
            changeRate: changeRatePct ?? null,
            tradingValue: accPrice24h ?? null,
            accTradePrice24h: accPrice24h ?? null,
            _raw: t,
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

    const getTickerInfo = (marketRaw) => {
        const key = normalizeMarketKey(marketRaw);
        if (!key) return null;
        const candidates = [key, key.replace("-", ""), key.toLowerCase(), key.replace("-", "").toLowerCase()];
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
        if (!raw) return null;
        if (typeof raw === "number") {
            const price = asNumber(raw);
            return {
                price: price ?? null,
                change: null,
                changeRate: null,
                tradingValue: null,
                accTradePrice24h: null,
                _raw: raw
            };
        }
        return getTickerInfoFromPayload(raw);
    };

    const formatKRW = (n) => {
        const num = Number(n);
        if (!Number.isFinite(num)) return "-";
        return `${Math.round(num).toLocaleString()} 원`;
    };

    // filtering
    const filtered = useMemo(() => {
        const q = (query || "").trim().toUpperCase();
        if (!q) return favorites;
        return favorites.filter((f) => {
            const market = (f.market || "").toUpperCase();
            const name = (f.korean_name || f.koreanName || f.name || "").toUpperCase();
            return market.includes(q) || name.includes(q);
        });
    }, [favorites, query, tickers, markets]);

    const getFavKey = (f) => {
        return f.id ?? f._id ?? f.tradingPairId ?? f.trading_pair_id ?? f.market ?? JSON.stringify(f);
    };

    const toggleOne = (key) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const allChecked = filtered.length > 0 && selectedIds.size === filtered.length;

    const toggleAll = () => {
        if (allChecked) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filtered.map(getFavKey)));
        }
    };

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

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return alert("삭제할 항목을 선택하세요");
        if (!confirm("선택한 관심코인을 삭제하시겠습니까?")) return;

        const ids = Array.from(selectedIds);
        if (typeof onDeleteSelected === "function") {
            try {
                await onDeleteSelected(ids);
                setSelectedIds(new Set());
            } catch (e) {
                console.error("삭제 실패", e);
                alert(e?.message || "삭제 실패");
            }
        } else {
            alert("삭제 핸들러(onDeleteSelected)가 제공되지 않았습니다. 부모에 구현하여 전달해 주세요.");
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
                {/* Add 버튼: hover 색상 변경, transition */}
                <button
                    onClick={handleAdd}
                    disabled={loading}
                    className="px-4 py-2 bg-white/5 rounded text-white hover:bg-indigo-500 transition-colors"
                >
                    추가
                </button>
            </div>

            <div className="grid items-center" style={{gridTemplateColumns: cols, gap: "1rem"}}>
                <div className="flex items-center gap-2">
                    <input type="checkbox" checked={allChecked} onChange={toggleAll}/>
                    <span>코인명</span>
                </div>
                <div className="text-right">현재가</div>
                <div className="text-right">전일대비</div>
                <div className="text-right">거래대금</div>
            </div>

            {filtered.length === 0 ? (
                <div>관심 코인이 없습니다.</div>
            ) : (
                filtered.map((f, idx) => {
                    const key = getFavKey(f);
                    const ticker = getTickerInfo(f.market);
                    const price = ticker?.price;
                    const change = ticker?.change; // stored as prev - price
                    const changeRate = ticker?.changeRate;
                    const accPrice24h = ticker?.accTradePrice24h;
                    const displayChange = change != null ? -change : null;
                    const displayRate = changeRate != null ? -changeRate : null;
                    const changeColor = displayChange == null ? "text-white/60" : displayChange >= 0 ? "text-red-400" : "text-blue-400";
                    const displayRateText = displayRate != null ? `${displayRate >= 0 ? "+" : ""}${displayRate.toFixed(2)}%` : "-";

                    return (
                        <div key={`${key}-${idx}`} className="bg-[#0b0f1a]/70 p-3 rounded">
                            <div className="grid items-center" style={{gridTemplateColumns: cols, gap: "1rem"}}>
                                <div className="flex items-center gap-3">
                                    <input type="checkbox" checked={selectedIds.has(key)}
                                           onChange={() => toggleOne(key)}/>
                                    <div>
                                        {f.korean_name ?? f.koreanName ?? f.name} ({(f.market ?? "").split("-")[1] ?? ""})
                                    </div>
                                </div>

                                <div className="text-right">{price != null ? formatKRW(price) : "-"}</div>

                                <div className={`text-right ${changeColor}`}>{displayRateText}</div>

                                <div
                                    className="text-right">{accPrice24h != null ? formatTradingValue(accPrice24h) : "-"}</div>
                            </div>
                        </div>
                    );
                })
            )}

            {/* 리스트 아래 오른쪽 정렬된 삭제 버튼 (겹침 제거) */}
            <div className="flex justify-end mt-2">
                <button
                    onClick={handleDeleteSelected}
                    className={`px-4 py-2 rounded text-white transition-colors duration-150 
    ${selectedIds.size === 0 ? "bg-white/5 cursor-not-allowed opacity-60" : "bg-transparent"}
    hover:bg-red-600 hover:text-white`}
                >
                    삭제
                </button>
            </div>
        </div>
    );
}