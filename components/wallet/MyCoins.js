import React, { useEffect, useMemo, useState } from "react";

/**
 * MyCoins (보유코인) — 전체 파일
 * 변경사항 요약:
 * - markets에서 한글명(korean_name / koreanName) 우선으로 사용, 폴백으로 coin 필드 사용
 * - 상단: 한글명 위 / (SYMBOL) 아래로 표시
 * - 우측: "평가손익" 라벨은 왼쪽 정렬, 값은 오른쪽 정렬
 * - 중간/하단 행은 요청대로 모두 오른쪽 정렬(셀 오른쪽 끝에 붙음)
 *
 * 부모에서 전달되는 props:
 *  markets, assets, filteredAssets, openDrawer, drawerOpen, selectedMarket, closeDrawer, onSave, onDelete, editCoinBalance, setEditCoinBalance, editAvgBuyPrice, setEditAvgBuyPrice
 */

export default function MyCoins({
                                    markets = [],
                                    coinInput = "",
                                    setCoinInput = () => {},
                                    coinBalanceInput = "",
                                    setCoinBalanceInput = () => {},
                                    coinAvgPriceInput = "",
                                    setCoinAvgPriceInput = () => {},
                                    handleAddCoin = () => {},
                                    assets = [],
                                    rawCoinAssets = [],
                                    filteredAssets = [],
                                    openDrawer = () => {},
                                    drawerOpen = false,
                                    selectedMarket = null,
                                    closeDrawer = () => {},
                                    onSave = () => {},
                                    onDelete = () => {},
                                    editCoinBalance = "",
                                    setEditCoinBalance = () => {},
                                    editAvgBuyPrice = "",
                                    setEditAvgBuyPrice = () => {},
                                }) {
    const hasAssets = Array.isArray(filteredAssets) && filteredAssets.length > 0;

    const fKRW = (n) => {
        const num = Number(n || 0);
        return !Number.isFinite(num) || num === 0 ? "0 KRW" : `${Math.round(num).toLocaleString()} KRW`;
    };
    const fNum = (n) => {
        const num = Number(n || 0);
        return !Number.isFinite(num) ? "0" : num % 1 === 0 ? num.toLocaleString() : num.toLocaleString(undefined, { maximumFractionDigits: 8 });
    };

    const resolveDisplayName = (coin) => {
        // markets에서 한글명 우선
        if (Array.isArray(markets) && coin?.market) {
            const m = markets.find((x) => String(x.market) === String(coin.market));
            if (m) return m.korean_name ?? m.koreanName ?? m.korean ?? null;
        }
        // coin 내부 필드 폴백
        return (
            coin?.koreanName ??
            coin?.korean_name ??
            coin?.coinName ??
            coin?.name ??
            (coin?.coinSymbol || "")
        );
    };

    return (
        <div className="space-y-4">
            {/* 입력 섹션 */}
            <section className="rounded-2xl bg-white/5 p-5 border border-white/5 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="text-sm font-semibold">보유코인</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px_140px] gap-2">
                    <MarketCombobox
                        markets={markets}
                        value={coinInput}
                        onChange={(m) => setCoinInput(m)}
                        placeholder="코인 검색 (예: 비트코인, BTC)"
                        limit={12}
                    />
                    <input
                        type="number"
                        value={coinBalanceInput}
                        onChange={(e) => setCoinBalanceInput(e.target.value)}
                        placeholder="보유수량"
                        className="px-3 py-2 rounded bg-white/10"
                    />
                    <input
                        type="number"
                        value={coinAvgPriceInput}
                        onChange={(e) => setCoinAvgPriceInput(e.target.value)}
                        placeholder="매수평균가(원)"
                        className="px-3 py-2 rounded bg-white/10"
                    />
                    <button onClick={handleAddCoin} className="px-4 py-2 bg-indigo-500 rounded font-semibold">
                        등록
                    </button>
                </div>

                <div className="text-xs text-white/50">
                    매수금액은 <b>보유수량 × 매수평균가</b>로 서버에서 자동 계산됩니다.
                </div>
            </section>

            {/* 리스트 섹션 */}
            <section className="rounded-2xl bg-white/5 border border-white/5 overflow-hidden">
                {!hasAssets ? (
                    <div className="p-5 text-white/50 text-sm">보유 코인이 없습니다.</div>
                ) : (
                    filteredAssets.map((coin) => {
                        const profitNum = Number(coin?.profit ?? 0);
                        const profitRateNum = Number(coin?.profitRate ?? 0);
                        const profitColor = profitNum >= 0 ? "text-red-400" : "text-blue-400";
                        const rateColor = profitRateNum >= 0 ? "text-red-400" : "text-blue-400";

                        const displayName = resolveDisplayName(coin);

                        return (
                            <div
                                key={String(coin.market) || Math.random()}
                                onClick={() => openDrawer(coin.market)}
                                className="w-full px-5 py-4 hover:bg-white/5 transition cursor-pointer"
                            >
                                {/* Row 1 — 가운데를 기준으로 라벨(왼쪽) / 값(오른쪽) 분리 */}
                                <div className="grid grid-cols-[1.2fr_1fr] items-start">
                                    {/* 왼쪽: 코인명 블록 */}
                                    <div>
                                        <div className="text-base font-semibold leading-tight">{displayName}</div>
                                        {coin?.coinSymbol ? (
                                            <div className="text-base font-semibold leading-tight">({coin.coinSymbol})</div>
                                        ) : null}
                                    </div>

                                    {/* 오른쪽: 2행 x 2열 그리드 — 왼쪽 열은 '가운데 기준 바로 오른쪽'에 붙는 라벨, 오른쪽 열은 숫자(오른쪽 정렬) */}
                                    <div className="grid grid-rows-2 grid-cols-2 w-full">
                                        {/* 1행: 평가손익 (라벨) */}
                                        <div className="text-base font-semibold leading-tight">
                                            평가손익
                                        </div>
                                        {/* 1행: ���가손익 값 (오른쪽으로 붙��) */}
                                        <div className={`text-base leading-tight tabular-nums text-right ${profitColor} self-center`}>
                                            {Number(coin?.profit ?? 0) !== 0 ? `${Math.round(Number(coin.profit)).toLocaleString()}` : "-"}
                                        </div>

                                        {/* 2행: 수익률 (라벨) */}
                                        <div className="text-base font-semibold leading-tight">
                                            수익률
                                        </div>
                                        {/* 2행: 수익률 값 */}
                                        <div className={`text-base text-right ${rateColor} self-center`}>
                                            {Number.isFinite(profitRateNum) ? `${profitRateNum.toFixed(2)}%` : "-"}
                                        </div>
                                    </div>
                                </div>

                                {/* Row 2: 보유수량 | 매수평균가 — 숫자를 Row1과 동일한 크기/굵기로 */}
                                <div className="mt-3 grid grid-cols-2">
                                    <div className="justify-self-end text-right">
                                        <div className="text-base leading-tight">
                                            {fNum(coin?.amount)} <span className="text-base leading-tight">{coin?.coinSymbol}</span>
                                        </div>
                                        <div className="text-sm text-white/60 mt-1">보유수량</div>
                                    </div>

                                    <div className="justify-self-end text-right">
                                        <div className="text-base leading-tight">{fKRW(coin?.avgPrice)}</div>
                                        <div className="text-sm text-white/60 mt-1">매수평균가</div>
                                    </div>
                                </div>

                                {/* Row 3: 평가금액 | 매수금액 — 숫자를 Row1과 동일한 크기/굵기로 */}
                                <div className="mt-3 grid grid-cols-2">
                                    <div className="justify-self-end text-right">
                                        <div className="text-base leading-tight">{fKRW(coin?.evalAmount)}</div>
                                        <div className="text-sm text-white/60 mt-1">평가금액</div>
                                    </div>

                                    <div className="justify-self-end text-right">
                                        <div className="text-base leading-tight">{fKRW(coin?.buyAmount)}</div>
                                        <div className="text-sm text-white/60 mt-1">매수금액</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </section>

            <CoinDetailDrawer
                open={drawerOpen}
                market={selectedMarket}
                onClose={closeDrawer}
                onSave={onSave}
                onDelete={onDelete}
                editCoinBalance={editCoinBalance}
                setEditCoinBalance={setEditCoinBalance}
                editAvgBuyPrice={editAvgBuyPrice}
                setEditAvgBuyPrice={setEditAvgBuyPrice}
                selectedCard={Array.isArray(assets) ? assets.find((a) => a.market === selectedMarket) : undefined}
            />
        </div>
    );
}

/* -------------------------
   MarketCombobox (간단 포함)
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
                const kor = normalize(m.korean_name);
                const eng = normalize(m.english_name);
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

/* -------------------------
   CoinDetailDrawer (간단 포함)
   ------------------------- */
function CoinDetailDrawer({ open, market, onClose, onSave, onDelete, editCoinBalance, setEditCoinBalance, editAvgBuyPrice, setEditAvgBuyPrice, selectedCard }) {
    if (!open) return null;

    const profitNum = Number(selectedCard?.profit || 0);
    const profitRateNum = Number(selectedCard?.profitRate || 0);
    const profitColor = profitNum >= 0 ? "text-red-400" : "text-blue-400";
    const rateColor = profitRateNum >= 0 ? "text-red-400" : "text-blue-400";

    const buyAmountNum = Number(selectedCard?.buyAmount || 0);

    return (
        <div className="fixed inset-0 z-50">
            <button className="absolute inset-0 bg-black/60" onClick={onClose} aria-label="close" />
            <div className="absolute right-0 top-0 h-full w-full sm:w-[420px] bg-[#0b0f1a] border-l border-white/10 p-5 overflow-y-auto">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-lg font-semibold">{market}</div>
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white">닫기</button>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                        <div className="text-xs text-white/50">평가손익</div>
                        <div className={`mt-1 text-lg font-semibold tabular-nums ${profitColor}`}>{profitNum.toLocaleString()}</div>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                        <div className="text-xs text-white/50">수익률</div>
                        <div className={`mt-1 text-lg font-semibold tabular-nums ${rateColor}`}>{profitRateNum.toFixed(2)}%</div>
                    </div>
                </div>

                <div className="mt-4 rounded-xl bg-white/5 border border-white/10 p-4">
                    <div className="text-xs text-white/50">총 매수금액</div>
                    <div className="mt-1 text-lg font-semibold tabular-nums">{buyAmountNum.toLocaleString()} KRW</div>
                    <div className="mt-1 text-[11px] text-white/40">보유수량 × 매수평균가로 서버에서 자동 계산됩니다.</div>
                </div>

                <div className="mt-6 space-y-3">
                    <Field label="보유수량">
                        <input value={editCoinBalance} onChange={(e) => setEditCoinBalance(e.target.value)} className="w-full px-3 py-2 rounded bg-white/10" placeholder="예: 0.0123" />
                    </Field>

                    <Field label="매수평균가(원)">
                        <input value={editAvgBuyPrice} onChange={(e) => setEditAvgBuyPrice(e.target.value)} className="w-full px-3 py-2 rounded bg-white/10" placeholder="예: 100000000" />
                    </Field>
                </div>

                <div className="mt-6 flex gap-2">
                    <button onClick={onSave} className="flex-1 px-4 py-2 rounded bg-indigo-500 font-semibold">저장</button>
                    <button onClick={onDelete} className="px-4 py-2 rounded bg-red-600/90 font-semibold">삭제</button>
                </div>

                <div className="mt-4 text-xs text-white/50 leading-relaxed">
                    • 매수금액은 서버에서 자동 계산되어 저장됩니다.<br />
                    • 업비트 화면 값처럼 <b>현재값을 그대로 덮어쓰기</b> 방식이에요.
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div>
            <div className="text-xs text-white/60 mb-1">{label}</div>
            {children}
        </div>
    );
}