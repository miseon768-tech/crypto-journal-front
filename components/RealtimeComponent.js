"use client";

import { useEffect, useRef, useState } from "react";
import { getStoredToken } from "../api/member";

export default function RealtimeComponent({ trading_pairs = [] }) {
    const [activeData, setActiveData] = useState("ticker");
    const [trades, setTrades] = useState([]);
    const [tickers, setTickers] = useState({});
    const [orderbooks, setOrderbooks] = useState({});
    const [candles, setCandles] = useState({});
    const [selectedSymbol, setSelectedSymbol] = useState("");

    const clientRef = useRef(null);
    const subsRef = useRef([]);
    const subscribedDestRef = useRef(new Set());
    const lastMessageAtRef = useRef(null);

    // symbol 매핑
    const tradingPairMap = Array.isArray(trading_pairs)
        ? trading_pairs.reduce((acc, tp) => {
            acc[tp.market] = tp;
            return acc;
        }, {})
        : {}; // trading_pairs가 없거나 배열이 아니면 빈 객체

    // 화면에 표시할 심볼
    const displaySymbol = (codeOrMarket) => {
        if (!codeOrMarket) return "";

        const pairs = Array.isArray(trading_pairs) ? trading_pairs : [];

        // KRW-ETH → ETH
        const pureSymbol = codeOrMarket.includes("-")
            ? codeOrMarket.split("-")[1]
            : codeOrMarket;

        // market 끝부분 기준으로 매칭
        const tp = pairs.find(tp =>
            tp.market.split("-")[1].toUpperCase() === pureSymbol.toUpperCase()
        );

        if (!tp) return pureSymbol;

        return `${tp.korean_name}(${pureSymbol})`;
    };

    // 필터 매칭 (한글/영문 모두 대응)
    const matchSymbol = (market, filter) => {
        if (!filter) return true;
        const tp = tradingPairMap[market];
        if (!tp) return false;
        const f = filter.toUpperCase();
        return tp.korean_name.includes(filter) || tp.english_name.toUpperCase().includes(f);
    };

    const pushDebug = (msg) => console.debug(msg);

    const normalizeKeysToCamel = (obj) => {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
        const out = {};
        Object.keys(obj).forEach((k) => {
            const v = obj[k];
            const nk = k.replace(/_([a-z])/g, (_, p1) => p1.toUpperCase());
            out[nk] = (v && typeof v === 'object' && !Array.isArray(v)) ? normalizeKeysToCamel(v) : v;
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

            const setupClient = (webSocketFactory, transportName = 'sockjs') => {
                const client = new Client({
                    webSocketFactory,
                    connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
                    reconnectDelay: 5000,
                    heartbeatIncoming: 4000,
                    heartbeatOutgoing: 4000,
                    debug: (msg) => pushDebug(`[STOMP][${transportName}] ${msg}`),
                });

                client.onConnect = () => {
                    const subscribeSafe = (destination, handler) => {
                        if (subscribedDestRef.current.has(destination)) return;
                        const sub = client.subscribe(destination, (msg) => {
                            const raw = msg?.body || '';
                            let parsed;
                            try { parsed = raw ? JSON.parse(raw) : raw; }
                            catch { parsed = raw; }
                            lastMessageAtRef.current = Date.now();
                            const normalized = (parsed && typeof parsed === 'object') ? normalizeKeysToCamel(parsed) : parsed;
                            handler(normalized);
                        });
                        subsRef.current.push(sub);
                        subscribedDestRef.current.add(destination);
                    };

                    subscribeSafe("/topic/trade", (data) => {
                        const trade = { symbol: data.market, price: data.tradePrice, quantity: data.tradeVolume };
                        setTrades((prev) => [trade, ...prev].slice(0, 10));
                    });

                    subscribeSafe("/topic/ticker", (data) => {
                        setTickers((prev) => ({ ...prev, [data.code]: data.tradePrice }));
                    });

                    subscribeSafe("/topic/orderbook", (data) => {
                        setOrderbooks((prev) => ({ ...prev, [data.code]: { bid: data.totalBidSize, ask: data.totalAskSize } }));
                    });

                    subscribeSafe("/topic/candle", (data) => {
                        setCandles((prev) => ({ ...prev, [data.market]: { open: data.openingPrice, close: data.tradePrice, high: data.highPrice, low: data.lowPrice } }));
                    });
                };

                client.activate();
                return client;
            };

            const sockFactory = () => new SockJS(sockUrl);
            clientRef.current = setupClient(sockFactory, 'sockjs');
        };

        initWebSocket();

        return () => {
            subsRef.current.forEach((s) => { try { s.unsubscribe(); } catch {} });
            if (clientRef.current) try { clientRef.current.deactivate(); } catch {}
        };
    }, []);

    // ---------------- UI ----------------
    const gridClass = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4";

    return (
        <div className="space-y-6 text-white p-4">
            <h2 className="text-2xl font-bold">Realtime Data</h2>

            {/* 탭 */}
            <div className="flex gap-4 mb-4">
                {['trade', 'ticker', 'orderbook', 'candle'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveData(tab)}
                        className={`px-4 py-2 rounded-lg ${activeData === tab ? "bg-indigo-500" : "bg-white/10"}`}>
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* 심볼 필터 */}
            <div className="flex items-center gap-2 justify-end">
                <input
                    value={selectedSymbol}
                    onChange={(e) => setSelectedSymbol(e.target.value.trim())}
                    placeholder="심볼 필터 (예: BTC 또는 비트코인)"
                    className="px-3 py-2 rounded bg-gray-800"
                />
                <button onClick={() => setSelectedSymbol("")} className="px-3 py-2 rounded bg-white/10">Clear</button>
            </div>

            {/* 데이터 표시 */}
            <div className={gridClass}>
                {activeData === "trade" &&
                    trades
                        .filter((t) => matchSymbol(t.symbol, selectedSymbol))
                        .map((trade, idx) => (
                            <div key={idx} className="bg-gray-900 p-3 rounded-lg flex flex-col items-center">
                                <span className="font-bold">{displaySymbol(trade.symbol)}</span>
                                <span className="text-green-400">{Number(trade.price).toLocaleString()}원</span>
                                <span className="text-sm">Qty: {trade.quantity}</span>
                            </div>
                        ))}

                {activeData === "ticker" &&
                    Object.entries(tickers)
                        .filter(([symbol]) => matchSymbol(symbol, selectedSymbol))
                        .map(([symbol, price]) => (
                            <div key={symbol} className="bg-gray-900 p-3 rounded-lg flex flex-col items-center">
                                <span className="font-bold">{displaySymbol(symbol)}</span>
                                <span className="text-green-400 text-lg">{Number(price).toLocaleString()}원</span>
                            </div>
                        ))}

                {activeData === "orderbook" &&
                    Object.entries(orderbooks)
                        .filter(([symbol]) => matchSymbol(symbol, selectedSymbol))
                        .map(([symbol, ob]) => (
                            <div key={symbol} className="bg-gray-900 p-3 rounded-lg flex flex-col items-center">
                                <span className="font-bold">{displaySymbol(symbol)}</span>
                                <span className="text-green-400">Bid: {ob?.bid ? Number(ob.bid).toLocaleString() : "-"}</span>
                                <span className="text-red-400">Ask: {ob?.ask ? Number(ob.ask).toLocaleString() : "-"}</span>
                            </div>
                        ))}

                {activeData === "candle" &&
                    Object.entries(candles)
                        .filter(([symbol]) => matchSymbol(symbol, selectedSymbol))
                        .map(([symbol, candle]) => {
                            const { open, close, high, low } = candle;
                            const minPrice = Math.min(open, close, high, low);
                            const maxPrice = Math.max(open, close, high, low);
                            const totalHeight = 60; // 캔들 높이
                            const scale = totalHeight / (maxPrice - minPrice || 1);

                            const topY = (maxPrice - high) * scale;
                            const bottomY = (maxPrice - low) * scale;
                            const bodyTop = (maxPrice - Math.max(open, close)) * scale;
                            const bodyHeight = Math.max((Math.max(open, close) - Math.min(open, close)) * scale, 2);
                            const isRise = close >= open;

                            return (
                                <div key={symbol} className="bg-gray-900 p-3 rounded-lg flex flex-col items-center">
                                    <span className="font-bold mb-1">{displaySymbol(symbol)}</span>
                                    <div className="relative w-6 h-[60px] flex justify-center">
                                        <div className="absolute w-1 bg-white" style={{ top: topY, height: bottomY - topY }}></div>
                                        <div
                                            className={`absolute w-4 ${isRise ? 'bg-green-400' : 'bg-red-500'}`}
                                            style={{ top: bodyTop, height: bodyHeight, borderRadius: 2 }}
                                        ></div>
                                    </div>
                                    <span className="text-sm mt-1">{close}</span>
                                </div>
                            );
                        })}
            </div>
        </div>
    );
}