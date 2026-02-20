import { useEffect, useMemo, useState } from "react";
import {
    getTotalAssets,
    getTotalEvalAmount,
    getTotalProfit,
    getTotalProfitRate,
    getPortfolioAsset,
    getCoinEvalAmount,
    getCoinProfit,
} from "../api/assetPriceStream";

import { upsertCashBalance, getCashBalance } from "../api/krwAsset";

import {
    getAllCoinAssets,
    createCoinAsset,
    updateCoinAsset,
    deleteCoinAsset,
    upsertCoinBuyAmount,
    getCoinBuyAmount,
    getTotalCoinBuyAmount,
} from "../api/coinAsset";

import { getFavoriteCoins } from "../api/favoriteCoin";
import { getAllMarkets } from "../api/tradingPair";
import { getStoredToken } from "../api/member";

export default function WalletComponent() {
    const [activeTab, setActiveTab] = useState("myAssets");

    const [summary, setSummary] = useState({
        totalAsset: 0,
        totalEval: 0,
        totalProfit: 0,
        profitRate: 0,
        cashBalance: 0,
        totalBuyAmount: 0,
    });

    const [assets, setAssets] = useState([]); // 카드에 표시할 "가공 데이터"
    const [rawCoinAssets, setRawCoinAssets] = useState([]); // 백엔드 CoinAsset 원본
    const [portfolio, setPortfolio] = useState([]);
    const [loading, setLoading] = useState(true);
    const [markets, setMarkets] = useState([]);
    const [favorites, setFavorites] = useState([]);

    // inputs
    const [krwInput, setKrwInput] = useState("");

    // 등록 폼
    const [coinInput, setCoinInput] = useState(""); // ✅ 선택된 market (예: KRW-BTC)
    const [coinBalanceInput, setCoinBalanceInput] = useState("");
    const [coinAvgPriceInput, setCoinAvgPriceInput] = useState("");

    // 상세/수정 drawer
    const [selectedMarket, setSelectedMarket] = useState(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editCoinBalance, setEditCoinBalance] = useState("");
    const [editAvgBuyPrice, setEditAvgBuyPrice] = useState("");
    const [editBuyAmount, setEditBuyAmount] = useState("");

    // 리스트 검색
    const [coinFilter, setCoinFilter] = useState("");

    const token =
        typeof window !== "undefined"
            ? getStoredToken(localStorage.getItem("token"))
            : null;

    useEffect(() => {
        if (!token) return;
        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const fetchAll = async () => {
        setLoading(true);
        try {
            await Promise.all([
                fetchWalletData(),
                fetchCoins(),
                fetchMarkets(),
                fetchFavorites(),
            ]);
        } finally {
            setLoading(false);
        }
    };

    const fetchWalletData = async () => {
        try {
            const results = await Promise.allSettled([
                getTotalAssets(token),
                getTotalEvalAmount(token),
                getTotalProfit(token),
                getTotalProfitRate(token),
                getPortfolioAsset(token),
                getCashBalance(token),
                getTotalCoinBuyAmount(token),
            ]);

            const getValue = (idx, fallback) => {
                const r = results[idx];
                return r && r.status === "fulfilled" ? r.value : fallback;
            };

            const totalAssetData = getValue(0, 0);
            const totalEvalData = getValue(1, 0);
            const totalProfitData = getValue(2, 0);
            const profitRateData = getValue(3, 0);
            const portfolioData = getValue(4, []);
            const cashBalanceData = getValue(5, 0);
            const totalBuyAmountData = getValue(6, 0);

            const totalAsset =
                typeof totalAssetData === "number"
                    ? totalAssetData
                    : totalAssetData?.totalAssets ?? 0;
            const totalEval =
                typeof totalEvalData === "number"
                    ? totalEvalData
                    : totalEvalData?.totalEvalAmount ?? 0;
            const totalProfit =
                typeof totalProfitData === "number"
                    ? totalProfitData
                    : totalProfitData?.totalProfit ?? 0;
            const profitRate =
                typeof profitRateData === "number"
                    ? profitRateData
                    : profitRateData?.totalProfitRate ?? 0;

            const cashBalance =
                typeof cashBalanceData === "number"
                    ? cashBalanceData
                    : cashBalanceData?.cashBalance ??
                    cashBalanceData?.cash_balance ??
                    0;

            const totalBuyAmount =
                typeof totalBuyAmountData === "number"
                    ? totalBuyAmountData
                    : totalBuyAmountData?.totalBuyAmount ??
                    totalBuyAmountData?.total_buy_amount ??
                    0;

            setSummary({
                totalAsset,
                totalEval,
                totalProfit,
                profitRate: (Number(profitRate) || 0).toFixed(2),
                cashBalance,
                totalBuyAmount,
            });

            const list = Array.isArray(portfolioData)
                ? portfolioData
                : portfolioData?.portfolioItemList ?? portfolioData?.portfolio ?? [];
            const formattedPortfolio = (list || []).map((p) => ({
                tradingPair: p.tradingPair || p.trading_pair || p.name || "UNKNOWN",
                percent: Number(p.percent ?? 0),
            }));
            setPortfolio(formattedPortfolio);
        } catch (e) {
            console.error("Wallet fetch error:", e);
        }
    };

    const fetchCoins = async () => {
        if (!token) return;

        try {
            const coinAssets = await getAllCoinAssets(token);
            const normalized = Array.isArray(coinAssets) ? coinAssets : [];
            setRawCoinAssets(normalized);

            const assetPromises = normalized.map(async (c) => {
                const market = c.market || c.tradingPair || c.trading_pair;
                const coinSymbol = market?.includes("-") ? market.split("-")[1] : market;

                const [evalRes, profitRes, buyAmountRes] = await Promise.allSettled([
                    getCoinEvalAmount(token, market),
                    getCoinProfit(token, market),
                    getCoinBuyAmount(market, token),
                ]);

                const evalAmount =
                    evalRes.status === "fulfilled" ? Number(evalRes.value) : 0;
                const profit =
                    profitRes.status === "fulfilled" ? Number(profitRes.value) : 0;
                const buyAmount =
                    buyAmountRes.status === "fulfilled" ? Number(buyAmountRes.value) : 0;

                const profitRate = buyAmount
                    ? ((profit / buyAmount) * 100).toFixed(2)
                    : "0.00";

                return {
                    market,
                    coinSymbol,
                    amount: Number(c.coinBalance ?? 0),
                    avgPrice: Number(c.avgBuyPrice ?? 0),
                    buyAmount,
                    evalAmount,
                    profit,
                    profitRate,
                };
            });

            setAssets(await Promise.all(assetPromises));
        } catch (e) {
            console.error("보유코인 데이터 가져오기 실패:", e);
            setAssets([]);
            setRawCoinAssets([]);
        }
    };

    const fetchMarkets = async () => {
        try {
            const data = await getAllMarkets();
            const all = data.tradingPairs || data.trading_pairs || [];

            // ✅ "어차피 다 KRW" => KRW- 마켓만 노출
            const onlyKrw = all.filter((m) =>
                String(m.market || "").toUpperCase().startsWith("KRW-")
            );

            setMarkets(onlyKrw);
        } catch (e) {
            console.error("마켓 불러오기 실패:", e);
        }
    };

    const fetchFavorites = async () => {
        if (!token) return;
        try {
            const data = await getFavoriteCoins(token);
            setFavorites(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error("관심 코인 불러오기 실패:", e);
        }
    };

    const handleAddKrw = async () => {
        if (!krwInput || isNaN(krwInput) || Number(krwInput) <= 0) {
            return alert("0보다 큰 금액을 입력하세요");
        }
        try {
            await upsertCashBalance(token, Number(krwInput));
            setKrwInput("");
            await fetchWalletData();
            alert("✅ KRW가 성공적으로 등록되었습니다!");
        } catch (e) {
            console.error(e);
            alert("❌ KRW 등록 실패");
        }
    };

    const handleAddCoin = async () => {
        if (!coinInput || coinBalanceInput === "" || isNaN(coinBalanceInput)) {
            return alert("코인과 보유수량을 정확히 입력하세요");
        }
        if (Number(coinBalanceInput) < 0)
            return alert("보유수량은 0 이상이어야 합니다.");

        try {
            await createCoinAsset(
                {
                    market: coinInput.toUpperCase(), // ✅ 예: KRW-BTC
                    coinBalance: Number(coinBalanceInput),
                    avgBuyPrice:
                        coinAvgPriceInput === "" ? null : Number(coinAvgPriceInput),
                    buyAmount: null,
                },
                token
            );

            setCoinInput("");
            setCoinBalanceInput("");
            setCoinAvgPriceInput("");

            await fetchCoins();
            await fetchWalletData();
            alert("✅ 코인 등록 완료");
        } catch (e) {
            console.error(e);
            alert("코인 등록 실패");
        }
    };

    const openDrawer = async (market) => {
        setSelectedMarket(market);
        setDrawerOpen(true);

        // 현재 카드/원본값 기반으로 초기값 세팅
        const card = assets.find((a) => a.market === market);
        const raw = rawCoinAssets.find((a) => (a.market || a.tradingPair) === market);

        setEditCoinBalance(String(card?.amount ?? raw?.coinBalance ?? ""));
        setEditAvgBuyPrice(String(card?.avgPrice ?? raw?.avgBuyPrice ?? ""));

        // buyAmount는 별도 API로 가져와야 정확함
        try {
            const buyAmount = await getCoinBuyAmount(market, token);
            setEditBuyAmount(String(buyAmount ?? ""));
        } catch {
            setEditBuyAmount("");
        }
    };

    const closeDrawer = () => {
        setDrawerOpen(false);
        setSelectedMarket(null);
        setEditCoinBalance("");
        setEditAvgBuyPrice("");
        setEditBuyAmount("");
    };

    const handleSaveCoinDetail = async () => {
        if (!selectedMarket) return;

        // 숫자 검증(빈 값은 "수정 안 함"으로 처리하고 싶으면 null로)
        const coinBalance = editCoinBalance === "" ? null : Number(editCoinBalance);
        const avgBuyPrice = editAvgBuyPrice === "" ? null : Number(editAvgBuyPrice);
        const buyAmount = editBuyAmount === "" ? null : Number(editBuyAmount);

        if (coinBalance !== null && Number.isNaN(coinBalance)) return alert("보유수량이 숫자가 아닙니다");
        if (avgBuyPrice !== null && Number.isNaN(avgBuyPrice)) return alert("평단이 숫자가 아닙니다");
        if (buyAmount !== null && Number.isNaN(buyAmount)) return alert("매수금액이 숫자가 아닙니다");

        try {
            // 1) 코인 정보(수량/평단) 저장
            await updateCoinAsset(
                {
                    market: selectedMarket,
                    coinBalance,
                    avgBuyPrice,
                    buyAmount: null, // buyAmount는 아래 별도 API로 저장
                },
                token
            );

            // 2) 매수금액 저장(입력한 경우에만)
            if (buyAmount !== null) {
                await upsertCoinBuyAmount(selectedMarket, buyAmount, token);
            }

            await fetchCoins();
            await fetchWalletData();
            closeDrawer();
            alert("✅ 저장 완료");
        } catch (e) {
            console.error(e);
            alert("저장 실패");
        }
    };

    const handleDeleteCoin = async () => {
        if (!selectedMarket) return;
        if (!confirm(`${selectedMarket} 자산을 삭제할까요?`)) return;

        try {
            await deleteCoinAsset(selectedMarket, token);
            await fetchCoins();
            await fetchWalletData();
            closeDrawer();
        } catch (e) {
            console.error(e);
            alert("코인 삭제 실패");
        }
    };

    const filteredAssets = useMemo(() => {
        const q = coinFilter.trim().toUpperCase();
        if (!q) return assets;
        return assets.filter(
            (a) =>
                a.market?.toUpperCase().includes(q) ||
                a.coinSymbol?.toUpperCase().includes(q)
        );
    }, [assets, coinFilter]);

    return (
        <div className="text-white">
            <div className="px-4 pt-3 border-b border-white/10 flex gap-7">
                <TopTab active={activeTab === "myAssets"} onClick={() => setActiveTab("myAssets")}>
                    보유자산
                </TopTab>
                <TopTab active={activeTab === "coins"} onClick={() => setActiveTab("coins")}>
                    보유코인
                </TopTab>
                <TopTab active={activeTab === "portfolio"} onClick={() => setActiveTab("portfolio")}>
                    포트폴리오
                </TopTab>
            </div>

            <div className="p-4 space-y-4">
                {loading && (
                    <div className="flex justify-center items-center py-20">
                        <div className="text-gray-400 text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                            <p>데이터를 불러오는 중...</p>
                        </div>
                    </div>
                )}

                {!loading && activeTab === "myAssets" && (
                    <div className="space-y-4">
                        <section className="rounded-2xl bg-white/5 p-5 border border-white/5">
                            <div className="text-lg font-semibold">내 보유자산</div>

                            <div className="mt-4 grid grid-cols-2 gap-6">
                                <div>
                                    <div className="text-sm text-white/60">보유 KRW</div>
                                    <div className="mt-2 text-4xl font-semibold tabular-nums">
                                        {Number(summary.cashBalance || 0).toLocaleString()}
                                    </div>
                                </div>

                                <div className="border-l border-white/10 pl-6">
                                    <div className="text-sm text-white/60">보유자산</div>
                                    <div className="mt-2 text-4xl font-semibold tabular-nums">
                                        {Number(summary.totalAsset || 0).toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 grid grid-cols-2 gap-x-10 gap-y-3 text-sm">
                                <MetricRow label="총 매수" value={`${Number(summary.totalBuyAmount || 0).toLocaleString()} KRW`} />
                                <MetricRow
                                    label="평가손익"
                                    value={`${Number(summary.totalProfit || 0).toLocaleString()} KRW`}
                                    valueClass={Number(summary.totalProfit || 0) >= 0 ? "text-red-400" : "text-blue-400"}
                                />
                                <MetricRow label="총 평가" value={`${Number(summary.totalEval || 0).toLocaleString()} KRW`} />
                                <MetricRow
                                    label="수익률"
                                    value={`${Number(summary.profitRate || 0).toLocaleString()}%`}
                                    valueClass={Number(summary.profitRate || 0) >= 0 ? "text-red-400" : "text-blue-400"}
                                />
                                <MetricRow label="주문가능" value={`${Number(summary.cashBalance || 0).toLocaleString()} KRW`} />
                                <div />
                            </div>
                        </section>

                        <section className="rounded-2xl bg-white/5 p-5 border border-white/5">
                            <div className="text-sm font-semibold mb-3">보유 현금 (KRW) 등록/수정</div>

                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={krwInput}
                                    onChange={(e) => setKrwInput(e.target.value)}
                                    placeholder="보유 KRW 금액 입력"
                                    className="px-3 py-2 rounded-lg bg-white/10 flex-1"
                                    min="0"
                                />
                                <button
                                    onClick={handleAddKrw}
                                    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg font-semibold transition shrink-0"
                                >
                                    등록/수정
                                </button>
                            </div>

                            <div className="mt-3 text-sm text-white/70">
                                현재 보유:{" "}
                                <span className="font-bold text-white">{Number(summary.cashBalance || 0).toLocaleString()}원</span>
                            </div>
                        </section>
                    </div>
                )}

                {!loading && activeTab === "coins" && (
                    <div className="space-y-4">
                        <section className="rounded-2xl bg-white/5 p-5 border border-white/5 space-y-4">

                            <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px_140px] gap-2">
                                {/* 최신 반영: 긴 select -> 검색 콤보박스 ("비트코인(BTC)" + BTC 입력시 자동) */}
                                <MarketCombobox
                                    markets={markets}
                                    value={coinInput}
                                    onChange={(m) => setCoinInput(m)} // m = KRW-BTC
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
                                    placeholder="평단(선택)"
                                    className="px-3 py-2 rounded bg-white/10"
                                />

                                <button onClick={handleAddCoin} className="px-4 py-2 bg-indigo-500 rounded font-semibold">
                                    등록
                                </button>
                            </div>


                        </section>

                        <section className="rounded-2xl bg-white/5 border border-white/5 overflow-hidden">
                            <div className="px-5 py-3 border-b border-white/10 text-xs text-white/60 grid grid-cols-[1.2fr_1fr_1fr_1fr_80px]">
                                <div>코인</div>
                                <div className="text-right">평가금액</div>
                                <div className="text-right">평가손익</div>
                                <div className="text-right">수익률</div>
                                <div className="text-right">관리</div>
                            </div>

                            {filteredAssets.length === 0 ? (
                                <div className="p-5 text-white/50 text-sm">보유 코인이 없습니다.</div>
                            ) : (
                                filteredAssets.map((coin) => {
                                    const profitNum = Number(coin.profit || 0);
                                    const profitRateNum = Number(coin.profitRate || 0);
                                    const profitColor = profitNum >= 0 ? "text-red-400" : "text-blue-400";
                                    const rateColor = profitRateNum >= 0 ? "text-red-400" : "text-blue-400";

                                    return (
                                        <button
                                            key={coin.market}
                                            onClick={() => openDrawer(coin.market)}
                                            className="w-full px-5 py-4 grid grid-cols-[1.2fr_1fr_1fr_1fr_80px] text-left hover:bg-white/5 transition"
                                        >
                                            <div>
                                                <div className="text-base font-semibold">{coin.coinSymbol}</div>
                                                <div className="text-xs text-white/50">{coin.market}</div>
                                            </div>

                                            <div className="text-right tabular-nums">
                                                {Number(coin.evalAmount || 0).toLocaleString()}
                                            </div>

                                            <div className={`text-right tabular-nums font-semibold ${profitColor}`}>
                                                {profitNum.toLocaleString()}
                                            </div>

                                            <div className={`text-right tabular-nums ${rateColor}`}>
                                                {profitRateNum.toFixed(2)}%
                                            </div>

                                            <div className="text-right text-xs text-white/60">보기</div>
                                        </button>
                                    );
                                })
                            )}
                        </section>

                        <CoinDetailDrawer
                            open={drawerOpen}
                            market={selectedMarket}
                            onClose={closeDrawer}
                            onSave={handleSaveCoinDetail}
                            onDelete={handleDeleteCoin}
                            editCoinBalance={editCoinBalance}
                            setEditCoinBalance={setEditCoinBalance}
                            editAvgBuyPrice={editAvgBuyPrice}
                            setEditAvgBuyPrice={setEditAvgBuyPrice}
                            editBuyAmount={editBuyAmount}
                            setEditBuyAmount={setEditBuyAmount}
                            selectedCard={assets.find((a) => a.market === selectedMarket)}
                        />
                    </div>
                )}

                {!loading && activeTab === "portfolio" && (
                    <section className="rounded-2xl bg-white/5 p-5 border border-white/5">
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                            <div className="flex justify-center">
                                <div className="h-56 w-56 rounded-full border border-white/10 flex items-center justify-center text-white/60">
                                    도넛차트 자리
                                </div>
                            </div>

                            <div className="space-y-3">
                                {portfolio.map((p) => (
                                    <div key={p.tradingPair} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="h-3 w-3 rounded-full bg-green-400/80" />
                                            <span className="font-medium">{p.tradingPair}</span>
                                        </div>
                                        <div className="tabular-nums text-white/80">{Number(p.percent || 0).toFixed(1)}%</div>
                                    </div>
                                ))}
                                {portfolio.length === 0 && <div className="text-white/50 text-sm">포트폴리오 데이터가 없습니다.</div>}
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}

function TopTab({ active, children, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`pb-3 text-base transition ${
                active ? "border-b-2 border-white font-semibold text-white" : "text-white/70 hover:text-white"
            }`}
        >
            {children}
        </button>
    );
}

function MetricRow({ label, value, valueClass = "text-white" }) {
    return (
        <div className="grid grid-cols-[88px_1fr] items-center">
            <span className="text-white/60">{label}</span>
            <span className={`tabular-nums text-right ${valueClass}`}>{value}</span>
        </div>
    );
}

function CoinDetailDrawer({
                              open,
                              market,
                              onClose,
                              onSave,
                              onDelete,
                              editCoinBalance,
                              setEditCoinBalance,
                              editAvgBuyPrice,
                              setEditAvgBuyPrice,
                              editBuyAmount,
                              setEditBuyAmount,
                              selectedCard,
                          }) {
    if (!open) return null;

    const profitNum = Number(selectedCard?.profit || 0);
    const profitRateNum = Number(selectedCard?.profitRate || 0);
    const profitColor = profitNum >= 0 ? "text-red-400" : "text-blue-400";
    const rateColor = profitRateNum >= 0 ? "text-red-400" : "text-blue-400";

    return (
        <div className="fixed inset-0 z-50">
            <button className="absolute inset-0 bg-black/60" onClick={onClose} aria-label="close" />

            <div className="absolute right-0 top-0 h-full w-full sm:w-[420px] bg-[#0b0f1a] border-l border-white/10 p-5 overflow-y-auto">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-lg font-semibold">{market}</div>
                        <div className="text-xs text-white/50 mt-1">상세보기 · 수정 · 매수금액 설정</div>
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white">
                        닫기
                    </button>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                        <div className="text-xs text-white/50">평가손익</div>
                        <div className={`mt-1 text-lg font-semibold tabular-nums ${profitColor}`}>
                            {profitNum.toLocaleString()}
                        </div>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                        <div className="text-xs text-white/50">수익률</div>
                        <div className={`mt-1 text-lg font-semibold tabular-nums ${rateColor}`}>
                            {profitRateNum.toFixed(2)}%
                        </div>
                    </div>
                </div>

                <div className="mt-6 space-y-3">
                    <Field label="보유수량">
                        <input
                            value={editCoinBalance}
                            onChange={(e) => setEditCoinBalance(e.target.value)}
                            className="w-full px-3 py-2 rounded bg-white/10"
                            placeholder="예: 0.0123"
                        />
                    </Field>

                    <Field label="매수평균가(원)">
                        <input
                            value={editAvgBuyPrice}
                            onChange={(e) => setEditAvgBuyPrice(e.target.value)}
                            className="w-full px-3 py-2 rounded bg-white/10"
                            placeholder="예: 100000000"
                        />
                    </Field>

                    <Field label="매수금액(원) - 업비트 총 매수 그대로 입력">
                        <input
                            value={editBuyAmount}
                            onChange={(e) => setEditBuyAmount(e.target.value)}
                            className="w-full px-3 py-2 rounded bg-white/10"
                            placeholder="예: 300000"
                        />
                    </Field>
                </div>

                <div className="mt-6 flex gap-2">
                    <button onClick={onSave} className="flex-1 px-4 py-2 rounded bg-indigo-500 font-semibold">
                        저장
                    </button>
                    <button onClick={onDelete} className="px-4 py-2 rounded bg-red-600/90 font-semibold">
                        삭제
                    </button>
                </div>

                <div className="mt-4 text-xs text-white/50 leading-relaxed">
                    • “추가로 더하기”가 아니라 업비트에 보이는 <b>현재값을 그대로 덮어쓰기</b> 방식이에요.<br />
                    • 매수금액은 코인별로 따로 저장하며, 수익률 계산에 사용돼요.
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

/**
 * ✅ 최신 반영: 코인 선택 검색 콤보박스
 * - KRW 마켓만 markets에 들어온다는 전제 (fetchMarkets에서 필터해도 됨)
 * - 표시: 비트코인(BTC)
 * - 입력: BTC/비트코인/Bitcoin 모두 가능
 * - 후보가 1개면 Enter로 자동 선택
 * - 선택 결과는 market(KRW-BTC)을 onChange로 전달
 */
function MarketCombobox({
                            markets,
                            value,
                            onChange,
                            placeholder = "코인 검색 (예: 비트코인, BTC)",
                            limit = 12,
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
        return markets.find((m) => m.market === value) || null;
    }, [markets, value]);

    const scored = useMemo(() => {
        const queryRaw = q.trim();
        const query = normalize(queryRaw);
        const base = markets || [];

        if (!query) return base.slice(0, limit).map((m) => ({ m, score: 0 }));

        const isSymbolOnly = /^[a-z0-9]{2,10}$/i.test(queryRaw);

        const results = base
            .map((m) => {
                const market = normalize(m.market); // krw-btc
                const kor = normalize(m.korean_name);
                const eng = normalize(m.english_name);
                const symbol = normalize(toSymbol(m.market)); // btc

                let score = 0;

                // 심볼 정확 일치 최우선 (BTC -> KRW-BTC)
                if (isSymbolOnly && symbol === query) score += 950;

                // 전체 market 정확 일치
                if (market === query) score += 1000;

                // 부분 포함
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
        onChange(m.market); // KRW-BTC
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
                                    <button
                                        type="button"
                                        key={m.market}
                                        onClick={() => pick(m)}
                                        className="w-full px-3 py-2 text-left hover:bg-white/5"
                                    >
                                        <div className="text-sm font-semibold">{label(m)}</div>
                                    </button>
                                ))
                            )}
                        </div>

                        <div className="px-3 py-2 text-[11px] text-white/40 border-t border-white/10">
                            {candidates.length === 1 ? "Enter로 자동 선택" : "클릭해서 선택"}
                        </div>
                    </div>

                    <button
                        type="button"
                        className="fixed inset-0 z-10 cursor-default"
                        onClick={() => setOpen(false)}
                        aria-label="close"
                    />
                </>
            )}
        </div>
    );
}