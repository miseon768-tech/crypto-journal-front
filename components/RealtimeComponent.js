"use client";

import { useEffect, useRef, useState } from "react";
import { getStoredToken } from "../api/member";

export default function RealtimeComponent() {
    const [activeData, setActiveData] = useState("ticker");
    const [trades, setTrades] = useState([]);
    const [tickers, setTickers] = useState({});
    const [orderbooks, setOrderbooks] = useState({});
    const [candles, setCandles] = useState({});
    const [status, setStatus] = useState("disconnected");
    const [error, setError] = useState(null);
    const [selectedSymbol, setSelectedSymbol] = useState("");

    const clientRef = useRef(null);
    const subsRef = useRef([]);
    const subscribedDestRef = useRef(new Set());

    const displaySymbol = (symbol) => (symbol ? String(symbol).toUpperCase() : symbol);

    const snakeToCamel = (s) => s.replace(/_([a-z])/g, (m, p1) => p1.toUpperCase());
    const normalizeKeysToCamel = (obj) => {
        if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
        const out = {};
        Object.keys(obj).forEach((k) => {
            const v = obj[k];
            const nk = snakeToCamel(k);
            out[nk] = v && typeof v === "object" && !Array.isArray(v) ? normalizeKeysToCamel(v) : v;
        });
        return out;
    };

    useEffect(() => {
        const initWebSocket = async () => {
            if (clientRef.current?.active) return;

            const token = getStoredToken();
            const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080").replace(/\/$/, "");
            const wsUrl = BACKEND.replace(/^http/, "ws") + "/ws/websocket";
            const sockUrl = `${BACKEND}/ws`;

            let Client, SockJS;
            try {
                Client = (await import("@stomp/stompjs")).Client;
                SockJS = (await import("sockjs-client")).default;
            } catch (e) {
                console.error("Realtime client import failed", e);
                setError("Realtime 클라이언트 로드 실패");
                setStatus("error");
                return;
            }

            const setupClient = (webSocketFactory) => {
                const client = new Client({
                    webSocketFactory,
                    connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
                    reconnectDelay: 5000,
                });

                client.onConnect = () => {
                    setStatus("connected");

                    const subscribeSafe = (destination, handler) => {
                        if (subscribedDestRef.current.has(destination)) return;
                        const sub = client.subscribe(destination, (msg) => {
                            let parsed;
                            try { parsed = msg.body ? JSON.parse(msg.body) : {}; } catch { parsed = msg.body; }
                            handler(parsed && typeof parsed === "object" ? normalizeKeysToCamel(parsed) : parsed);
                        });
                        subsRef.current.push(sub);
                        subscribedDestRef.current.add(destination);
                    };

                    subscribeSafe("/topic/trade", (data) => {
                        const trade = {
                            symbol: data.market,
                            price: data.tradePrice,
                            quantity: data.tradeVolume,
                        };
                        setTrades((prev) => [trade, ...prev].slice(0, 10));
                    });

                    subscribeSafe("/topic/ticker", (data) => {
                        setTickers((prev) => ({ ...prev, [data.code]: data.tradePrice }));
                    });

                    subscribeSafe("/topic/orderbook", (data) => {
                        setOrderbooks((prev) => ({
                            ...prev,
                            [data.code]: { bid: data.totalBidSize, ask: data.totalAskSize },
                        }));
                    });

                    subscribeSafe("/topic/candle", (data) => {
                        setCandles((prev) => ({
                            ...prev,
                            [data.market]: {
                                open: data.openingPrice,
                                close: data.tradePrice,
                                high: data.highPrice,
                                low: data.lowPrice,
                            },
                        }));
                    });
                };

                client.onStompError = (frame) => {
                    console.error("[STOMP] Error", frame);
                    setError(frame?.body || "STOMP error");
                    setStatus("error");
                };

                client.onWebSocketClose = () => setStatus("disconnected");
                client.onWebSocketError = (evt) => {
                    console.error("[WS] Error", evt);
                    setError(evt);
                    setStatus("error");
                };

                return client;
            };

            const sockFactory = () => new SockJS(sockUrl);
            const sockClient = setupClient(sockFactory);
            clientRef.current = sockClient;
            sockClient.activate();
        };

        initWebSocket();

        return () => {
            subsRef.current.forEach((s) => s.unsubscribe());
            subsRef.current = [];
            subscribedDestRef.current.clear();
            clientRef.current?.deactivate();
            clientRef.current = null;
        };
    }, []);

    return (
        <div className="space-y-6 text-white">
            <h2 className="text-2xl font-bold">Realtime Data</h2>

            <div className="flex gap-4 mb-4">
                {["trade", "ticker", "orderbook", "candle"].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveData(tab)}
                        className={`px-4 py-2 rounded-lg ${activeData === tab ? "bg-indigo-500" : "bg-white/10"}`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            <div className="flex items-center gap-2 justify-end">
                <input
                    value={selectedSymbol}
                    onChange={(e) => setSelectedSymbol(e.target.value.trim())}
                    placeholder="심볼 필터 (예: BTC)"
                    className="px-3 py-2 rounded bg-gray-800"
                />
                <button onClick={() => setSelectedSymbol("")} className="px-3 py-2 rounded bg-white/10">
                    Clear
                </button>
            </div>

            <div className="bg-white/10 p-4 rounded-xl min-h-[150px]">
                {activeData === "trade" &&
                    trades
                        .filter((t) => !selectedSymbol || displaySymbol(t.symbol).includes(selectedSymbol.toUpperCase()))
                        .map((trade, idx) => (
                            <div key={idx} className="flex justify-between border-b border-white/10 py-1 text-sm">
                                <span>{displaySymbol(trade.symbol)}</span>
                                <span>{Number(trade.price).toLocaleString()}원</span>
                                <span>{trade.quantity}</span>
                            </div>
                        ))}

                {activeData === "ticker" &&
                    Object.entries(tickers)
                        .filter(([symbol]) => !selectedSymbol || symbol.includes(selectedSymbol.toUpperCase()))
                        .map(([symbol, price]) => (
                            <div key={symbol} className="flex justify-between border-b border-white/10 py-1 text-sm">
                                <span>{displaySymbol(symbol)}</span>
                                <span>{Number(price).toLocaleString()}원</span>
                            </div>
                        ))}

                {activeData === "orderbook" &&
                    Object.entries(orderbooks)
                        .filter(([symbol]) => !selectedSymbol || symbol.includes(selectedSymbol.toUpperCase()))
                        .map(([symbol, ob]) => (
                            <div key={symbol} className="border-b border-white/10 py-1 text-sm">
                                <div>{displaySymbol(symbol)}</div>
                                <div>Bid: {ob?.bid ?? "-"}</div>
                                <div>Ask: {ob?.ask ?? "-"}</div>
                            </div>
                        ))}

                {activeData === "candle" &&
                    Object.entries(candles)
                        .filter(([symbol]) => !selectedSymbol || symbol.includes(selectedSymbol.toUpperCase()))
                        .map(([symbol, candle]) => (
                            <div key={symbol} className="border-b border-white/10 py-1 text-sm">
                                <div>{displaySymbol(symbol)}</div>
                                <div>Open: {candle.open}</div>
                                <div>Close: {candle.close}</div>
                                <div>High: {candle.high}</div>
                                <div>Low: {candle.low}</div>
                            </div>
                        ))}
            </div>
        </div>
    );
}