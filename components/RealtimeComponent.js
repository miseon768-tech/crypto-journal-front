"use client";

import { useEffect, useRef, useState } from "react";
import { getStoredToken } from "../api/member";

export default function RealtimeComponent({ trading_pairs = [] }) {
    const [activeData, setActiveData] = useState("ticker");
    const [trades, setTrades] = useState([]);
    const [tickers, setTickers] = useState({});
    const [orderbooks, setOrderbooks] = useState({});
    const [candles, setCandles] = useState({});
    const [selectedChoseong, setSelectedChoseong] = useState("");

    const clientRef = useRef(null);
    const subsRef = useRef([]);
    const subscribedDestRef = useRef(new Set());

    const tabs = [
        { key: "trade", label: "체결 (Trade)" },
        { key: "ticker", label: "현재가 (Ticker)" },
        { key: "orderbook", label: "호가 (Orderbook)" },
        { key: "candle", label: "캔들 (Candle)" },
    ];

    // ✅ 버튼에 보여줄 것(14개: 쌍자음 제외)
    const CHOSEONG_BUTTONS = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

    // ✅ 초성 ���산용(19개: 쌍자음 포함) — 이게 핵심
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

    // ✅ 한글 이름 첫 글자 -> 초성 리턴 (19개 리스트 기준)
    const getChoseongFromKoreanName = (koreanName) => {
        if (!koreanName) return "";
        const firstChar = String(koreanName).trim()[0];
        if (!firstChar) return "";

        const code = firstChar.charCodeAt(0);
        if (code < 0xac00 || code > 0xd7a3) return "";

        const index = Math.floor((code - 0xac00) / 588);
        return CHOSEONG_FOR_INDEX[index] ?? "";
    };

    // ✅ 필터 버튼이 14개��서(ㄲ ㄸ ㅃ ㅆ ㅉ 없음),
    //    계산 결과가 쌍자음이면 기본자음으로 눌러서 보이게 "합치기"
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

    useEffect(() => {
        const initWebSocket = async () => {
            const token = getStoredToken();
            const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080").replace(/\/$/, "");
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
                connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
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
                    const trade = { symbol: marketKey, price: data.tradePrice, quantity: data.tradeVolume };
                    setTrades((prev) => [trade, ...prev].slice(0, 50));
                });

                subscribeSafe("/topic/ticker", (data) => {
                    const marketKey = normalizeToMarketKey(data.code);
                    setTickers((prev) => ({ ...prev, [marketKey]: data.tradePrice }));
                });

                subscribeSafe("/topic/orderbook", (data) => {
                    const marketKey = normalizeToMarketKey(data.code);
                    setOrderbooks((prev) => ({
                        ...prev,
                        [marketKey]: { bid: data.totalBidSize, ask: data.totalAskSize },
                    }));
                });

                subscribeSafe("/topic/candle", (data) => {
                    const marketKey = normalizeToMarketKey(data.market);
                    setCandles((prev) => ({
                        ...prev,
                        [marketKey]: {
                            open: data.openingPrice,
                            close: data.tradePrice,
                            high: data.highPrice,
                            low: data.lowPrice,
                        },
                    }));
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
                } catch {}
            });
            if (clientRef.current) try { clientRef.current.deactivate(); } catch {}
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const gridClass = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4";

    return (
        <div className="space-y-6 text-white p-4">
            <h2 className="text-2xl font-bold">실시간 데이터(Realtime Data)</h2>

            {/* ✅ ㄱ~ㅎ 초성 필터 버튼 */}
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

            {/* ✅ 탭 */}
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

            <div className={gridClass}>
                {activeData === "trade" &&
                    trades
                        .filter((t) => matchChoseong(t.symbol, selectedChoseong))
                        .map((trade, idx) => (
                            <div key={`${trade.symbol}-${idx}`} className="bg-gray-900 p-3 rounded-lg flex flex-col items-center">
                                <span className="font-bold">{displaySymbol(trade.symbol)}</span>
                                <span className="text-green-400">{Number(trade.price).toLocaleString()}원</span>
                                <span className="text-sm">Qty: {trade.quantity}</span>
                            </div>
                        ))}

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
                                <span className="text-green-400">
                                    Bid: {ob?.bid ? Number(ob.bid).toLocaleString() : "-"}
                                </span>
                                <span className="text-red-400">
                                    Ask: {ob?.ask ? Number(ob.ask).toLocaleString() : "-"}
                                </span>
                            </div>
                        ))}

                {activeData === "candle" &&
                    Object.entries(candles)
                        .filter(([marketKey]) => matchChoseong(marketKey, selectedChoseong))
                        .map(([marketKey, candle]) => (
                            <div key={marketKey} className="bg-gray-900 p-3 rounded-lg flex flex-col items-center">
                                <span className="font-bold mb-1">{displaySymbol(marketKey)}</span>
                                <span className="text-sm mt-1">{candle.close}</span>
                            </div>
                        ))}
            </div>
        </div>
    );
}