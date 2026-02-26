"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import {getStoredToken} from "../api/member";
import CandleChart from "./CandleChart";

export default function RealtimeComponent({trading_pairs = []}) {
    const [activeData, setActiveData] = useState("ticker");

    // ✅ 체결은 50개까지 쌓고, 화면은 10개씩 페이��
    const [trades, setTrades] = useState([]);
    const [tradePage, setTradePage] = useState(1);
    const TRADE_PAGE_SIZE = 10;

    const [tickers, setTickers] = useState({});
    const [orderbooks, setOrderbooks] = useState({});
    const [candles, setCandles] = useState({}); // marketKey -> CandlePoint[]
    const [selectedMarket, setSelectedMarket] = useState("");
    const [selectedChoseong, setSelectedChoseong] = useState("");

    const clientRef = useRef(null);
    const subsRef = useRef([]);
    const subscribedDestRef = useRef(new Set());

    const tabs = [
        {key: "trade", label: "체결 (Trade)"},
        {key: "ticker", label: "현재가 (Ticker)"},
        {key: "orderbook", label: "호가 (Orderbook)"},
        {key: "candle", label: "캔들 (Candle)"},
    ];

    const CHOSEONG_BUTTONS = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

    const CHOSEONG_FOR_INDEX = [
        "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
        "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
    ];

    const tradingPairMap = Array.isArray(trading_pairs)
        ? trading_pairs.reduce((acc, tp) => {
            acc[tp.market] = tp;
            return acc;
        }, {})
        : {};

    const normalizeToMarketKey = (codeOrMarket) => {
        if (!codeOrMarket) return "";
        const s = String(codeOrMarket);
        if (s.includes("-")) return s;

        const sym = s.toUpperCase();
        const pairs = Array.isArray(trading_pairs) ? trading_pairs : [];

        const krw = pairs.find((tp) => tp.market.toUpperCase() === `KRW-${sym}`);
        if (krw) return krw.market;

        const any = pairs.find((tp) => tp.market.split("-")[1]?.toUpperCase() === sym);
        if (any) return any.market;

        return `KRW-${sym}`;
    };

    const displaySymbol = (codeOrMarket) => {
        if (!codeOrMarket) return "";
        const marketKey = normalizeToMarketKey(codeOrMarket);
        const tp = tradingPairMap[marketKey];
        const pureSymbol = marketKey.includes("-") ? marketKey.split("-")[1] : marketKey;
        if (!tp) return pureSymbol;
        return `${tp.korean_name}(${pureSymbol})`;
    };

    const getChoseongFromKoreanName = (koreanName) => {
        if (!koreanName) return "";
        const firstChar = String(koreanName).trim()[0];
        if (!firstChar) return "";

        const code = firstChar.charCodeAt(0);
        if (code < 0xac00 || code > 0xd7a3) return "";

        const index = Math.floor((code - 0xac00) / 588);
        return CHOSEONG_FOR_INDEX[index] ?? "";
    };

    const collapseDoubleChoseong = (ch) => {
        if (ch === "ㄲ") return "ㄱ";
        if (ch === "ㄸ") return "ㄷ";
        if (ch === "ㅃ") return "ㅂ";
        if (ch === "ㅆ") return "ㅅ";
        if (ch === "ㅉ") return "ㅈ";
        return ch;
    };

    const matchChoseong = (codeOrMarket, choseong) => {
        if (!choseong) return true;

        const marketKey = normalizeToMarketKey(codeOrMarket);
        const tp = tradingPairMap[marketKey];
        if (!tp?.korean_name) return false;

        const ch = getChoseongFromKoreanName(tp.korean_name);
        const collapsed = collapseDoubleChoseong(ch);

        return collapsed === choseong;
    };

    const normalizeKeysToCamel = (obj) => {
        if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
        const out = {};
        Object.keys(obj).forEach((k) => {
            const v = obj[k];
            const nk = k.replace(/_([a-z])/g, (_, p1) => p1.toUpperCase());
            out[nk] = v && typeof v === "object" && !Array.isArray(v) ? normalizeKeysToCamel(v) : v;
        });
        return out;
    };

    const candleMarketOptions = useMemo(() => {
        return Object.keys(candles).filter((marketKey) => matchChoseong(marketKey, selectedChoseong));
    }, [candles, selectedChoseong]);

    useEffect(() => {
        if (!candleMarketOptions.length) return;

        if (!selectedMarket || !candleMarketOptions.includes(selectedMarket)) {
            setSelectedMarket(candleMarketOptions[0]);
        }
    }, [candleMarketOptions, selectedMarket]);

    // ✅ 초성 바뀌면 trade 페이징 1페이지로
    useEffect(() => {
        setTradePage(1);
    }, [selectedChoseong]);

    useEffect(() => {
        const initWebSocket = async () => {
            const token = getStoredToken();
            const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://43.201.97.58:8081").replace(/\/$/, "");
            const sockUrl = `${BACKEND}/ws`;

            let Client, SockJS;
            try {
                Client = (await import("@stomp/stompjs")).Client;
                SockJS = (await import("sockjs-client")).default;
            } catch (e) {
                console.error("Realtime client import failed", e);
                return;
            }

            const client = new Client({
                webSocketFactory: () => new SockJS(sockUrl),
                connectHeaders: token ? {Authorization: `Bearer ${token}`} : {},
                reconnectDelay: 5000,
                heartbeatIncoming: 4000,
                heartbeatOutgoing: 4000,
            });

            client.onConnect = () => {
                const subscribeSafe = (destination, handler) => {
                    if (subscribedDestRef.current.has(destination)) return;
                    const sub = client.subscribe(destination, (msg) => {
                        let parsed;
                        try {
                            parsed = JSON.parse(msg.body);
                        } catch {
                            parsed = msg.body;
                        }
                        handler(normalizeKeysToCamel(parsed));
                    });
                    subsRef.current.push(sub);
                    subscribedDestRef.current.add(destination);
                };

                subscribeSafe("/topic/trade", (data) => {
                    const marketKey = normalizeToMarketKey(data.market);
                    const trade = {symbol: marketKey, price: data.tradePrice, quantity: data.tradeVolume};
                    setTrades((prev) => [trade, ...prev].slice(0, 50)); // ✅ 50개까지 누적
                });

                subscribeSafe("/topic/ticker", (data) => {
                    const marketKey = normalizeToMarketKey(data.code);
                    setTickers((prev) => ({...prev, [marketKey]: data.tradePrice}));
                });

                subscribeSafe("/topic/orderbook", (data) => {
                    const marketKey = normalizeToMarketKey(data.code);
                    setOrderbooks((prev) => ({
                        ...prev,
                        [marketKey]: {bid: data.totalBidSize, ask: data.totalAskSize},
                    }));
                });

                subscribeSafe("/topic/candle", (data) => {
                    const marketKey = normalizeToMarketKey(data.market);

                    const point = {
                        time: Math.floor(Number(data.timestamp) / 1000),
                        open: data.openingPrice,
                        high: data.highPrice,
                        low: data.lowPrice,
                        close: data.tradePrice,
                    };

                    setCandles((prev) => {
                        const prevArr = prev[marketKey] || [];

                        const last = prevArr[prevArr.length - 1];
                        let nextArr;
                        if (last && last.time === point.time) {
                            nextArr = [...prevArr];
                            nextArr[nextArr.length - 1] = point;
                        } else {
                            nextArr = [...prevArr, point];
                        }

                        const dedup = new Map();
                        for (const p of nextArr) dedup.set(p.time, p);
                        nextArr = Array.from(dedup.values())
                            .sort((a, b) => a.time - b.time)
                            .slice(-200);

                        return {...prev, [marketKey]: nextArr};
                    });

                    setSelectedMarket((m) => m || marketKey);
                });
            };

            client.activate();
            clientRef.current = client;
        };

        initWebSocket();

        return () => {
            subsRef.current.forEach((s) => {
                try {
                    s.unsubscribe();
                } catch {
                }
            });
            if (clientRef.current) {
                try {
                    clientRef.current.deactivate();
                } catch {
                }
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const gridClass = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4";

    // ✅ trade 페이지 계산(렌더에서 재사용)
    const filteredTrades = useMemo(() => {
        return trades.filter((t) => matchChoseong(t.symbol, selectedChoseong));
    }, [trades, selectedChoseong]);

    const totalTradePages = Math.max(1, Math.ceil(filteredTrades.length / TRADE_PAGE_SIZE));
    const safeTradePage = Math.min(tradePage, totalTradePages);
    const tradeStart = (safeTradePage - 1) * TRADE_PAGE_SIZE;
    const tradePageItems = filteredTrades.slice(tradeStart, tradeStart + TRADE_PAGE_SIZE);

    return (
        <div className="space-y-6 text-white p-4">
            <div className="flex gap-4 mb-4">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveData(tab.key)}
                        className={`px-4 py-2 rounded-lg ${activeData === tab.key ? "bg-indigo-500" : "bg-white/10"}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setSelectedChoseong("")}
                    className={`px-3 py-1 rounded-lg ${selectedChoseong === "" ? "bg-indigo-500" : "bg-white/10"}`}
                >
                    전체
                </button>

                {CHOSEONG_BUTTONS.map((c) => (
                    <button
                        key={c}
                        onClick={() => setSelectedChoseong(c)}
                        className={`px-3 py-1 rounded-lg ${selectedChoseong === c ? "bg-indigo-500" : "bg-white/10"}`}
                    >
                        {c}
                    </button>
                ))}
            </div>

            <div className={gridClass}>
                {activeData === "trade" && (
                    <div className="md:col-span-4 bg-gray-900 p-3 rounded-lg">
                        <div className="flex items-center mb-2">
                            {/* 왼쪽 빈 공간(밀어내기용) */}
                            <div className="flex-1"/>

                            {/* 오른쪽 페이징 */}
                            <div className="flex items-center gap-2 text-sm">
                                <button
                                    className="px-2 py-1 rounded bg-white/10 disabled:opacity-40"
                                    onClick={() => setTradePage((p) => Math.max(1, p - 1))}
                                    disabled={safeTradePage <= 1}
                                >
                                    이전
                                </button>

                                <span className="text-white/70 tabular-nums">
          {safeTradePage} / {totalTradePages}
        </span>

                                <button
                                    className="px-2 py-1 rounded bg-white/10 disabled:opacity-40"
                                    onClick={() => setTradePage((p) => Math.min(totalTradePages, p + 1))}
                                    disabled={safeTradePage >= totalTradePages}
                                >
                                    다음
                                </button>
                            </div>
                        </div>

                        {tradePageItems.length === 0 ? (
                            <div className="text-white/50 text-sm">체결 데이터가 없습니다.</div>
                        ) : (
                            <div className="space-y-1 text-sm">
                                {tradePageItems.map((trade, idx) => (
                                    <div
                                        key={`${trade.symbol}-${tradeStart + idx}`}
                                        className="flex items-center justify-between border-b border-white/10 py-1"
                                    >
                                        <div className="min-w-0">
                                            <span className="font-semibold">{displaySymbol(trade.symbol)}</span>
                                            <span className="text-white/60 ml-2">{trade.symbol}</span>
                                        </div>

                                        <div className="flex items-center gap-4">
              <span className="text-green-400 tabular-nums">
                {Number(trade.price).toLocaleString()}원
              </span>
                                            <span className="text-white/70 tabular-nums">수량: {trade.quantity}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeData === "ticker" &&
                    Object.entries(tickers)
                        .filter(([marketKey]) => matchChoseong(marketKey, selectedChoseong))
                        .map(([marketKey, price]) => (
                            <div key={marketKey} className="bg-gray-900 p-3 rounded-lg flex flex-col items-center">
                                <span className="font-bold">{displaySymbol(marketKey)}</span>
                                <span className="text-green-400 text-lg">{Number(price).toLocaleString()}원</span>
                            </div>
                        ))}

                {activeData === "orderbook" &&
                    Object.entries(orderbooks)
                        .filter(([marketKey]) => matchChoseong(marketKey, selectedChoseong))
                        .map(([marketKey, ob]) => (
                            <div key={marketKey} className="bg-gray-900 p-3 rounded-lg flex flex-col items-center">
                                <span className="font-bold">{displaySymbol(marketKey)}</span>
                                <span
                                    className="text-green-400">매수: {ob?.bid ? Number(ob.bid).toLocaleString() : "-"}</span>
                                <span
                                    className="text-red-400">매도: {ob?.ask ? Number(ob.ask).toLocaleString() : "-"}</span>
                            </div>
                        ))}

                {activeData === "candle" && (
                    <div className="md:col-span-4 bg-gray-900 p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="font-bold">캔들</span>

                            <select
                                value={selectedMarket}
                                onChange={(e) => setSelectedMarket(e.target.value)}
                                className="bg-white/10 rounded px-2 py-1"
                            >
                                {candleMarketOptions.map((marketKey) => (
                                    <option key={marketKey} value={marketKey}>
                                        {displaySymbol(marketKey)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <CandleChart data={candles[selectedMarket] || []}/>
                    </div>
                )}
            </div>
        </div>
    );
}