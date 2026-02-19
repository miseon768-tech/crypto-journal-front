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

    // ✅ 탭 key / label 분리
    const tabs = [
        { key: "trade", label: "체결 (Trade)" },
        { key: "ticker", label: "현재가 (Ticker)" },
        { key: "orderbook", label: "호가 (Orderbook)" },
        { key: "candle", label: "캔들 (Candle)" }
    ];

    const tradingPairMap = Array.isArray(trading_pairs)
        ? trading_pairs.reduce((acc, tp) => {
            acc[tp.market] = tp;
            return acc;
        }, {})
        : {};

    const displaySymbol = (codeOrMarket) => {
        if (!codeOrMarket) return "";

        const pairs = Array.isArray(trading_pairs) ? trading_pairs : [];

        const pureSymbol = codeOrMarket.includes("-")
            ? codeOrMarket.split("-")[1]
            : codeOrMarket;

        const tp = pairs.find(tp =>
            tp.market.split("-")[1].toUpperCase() === pureSymbol.toUpperCase()
        );

        if (!tp) return pureSymbol;

        return `${tp.korean_name}(${pureSymbol})`;
    };

    const matchSymbol = (market, filter) => {
        if (!filter) return true;
        const tp = tradingPairMap[market];
        if (!tp) return false;
        const f = filter.toUpperCase();
        return tp.korean_name.includes(filter) || tp.english_name.toUpperCase().includes(f);
    };

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
                        try { parsed = JSON.parse(msg.body); }
                        catch { parsed = msg.body; }

                        const normalized = normalizeKeysToCamel(parsed);
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
                    setCandles((prev) => ({
                        ...prev,
                        [data.market]: {
                            open: data.openingPrice,
                            close: data.tradePrice,
                            high: data.highPrice,
                            low: data.lowPrice
                        }
                    }));
                });
            };

            client.activate();
            clientRef.current = client;
        };

        initWebSocket();

        return () => {
            subsRef.current.forEach((s) => { try { s.unsubscribe(); } catch {} });
            if (clientRef.current) try { clientRef.current.deactivate(); } catch {}
        };
    }, []);

    const gridClass = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4";

    return (
        <div className="space-y-6 text-white p-4">
            <h2 className="text-2xl font-bold">실시간 데이터(Realtime Data)</h2>

            {/* ✅ 수정된 탭 */}
            <div className="flex gap-4 mb-4">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveData(tab.key)}
                        className={`px-4 py-2 rounded-lg ${
                            activeData === tab.key ? "bg-indigo-500" : "bg-white/10"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* 이하 데이터 표시 부분은 기존 그대로 */}
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
                        .map(([symbol, candle]) => (
                            <div key={symbol} className="bg-gray-900 p-3 rounded-lg flex flex-col items-center">
                                <span className="font-bold mb-1">{displaySymbol(symbol)}</span>
                                <span className="text-sm mt-1">{candle.close}</span>
                            </div>
                        ))}
            </div>
        </div>
    );
}