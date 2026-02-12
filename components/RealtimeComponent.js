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

    const displaySymbol = (symbol) => (symbol ? String(symbol).toUpperCase() : symbol);

    useEffect(() => {
        const initWebSocket = async () => {
            const token = getStoredToken();
            if (!token) {
                setError("로그인이 필요합니다.");
                setStatus("no-token");
                return;
            }

            const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080").replace(/\/$/, "");
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

            // STOMP Client 생성
            const client = new Client({
                webSocketFactory: () => new SockJS(`${BACKEND}/ws`),
                connectHeaders: { Authorization: `Bearer ${token}` },
                reconnectDelay: 5000,
                heartbeatIncoming: 4000,
                heartbeatOutgoing: 4000,
                debug: (msg) => console.debug("[STOMP DEBUG]", msg),
            });

            client.onConnect = () => {
                console.log("[Realtime] STOMP Connected!");
                setStatus("connected");
                setError(null);

                const subscribeSafe = (destination, handler) => {
                    try {
                        const sub = client.subscribe(destination, (msg) => {
                            try {
                                const data = JSON.parse(msg.body);
                                handler(data);
                            } catch (e) {
                                console.warn(`parse error for ${destination}`, e);
                            }
                        });
                        subsRef.current.push(sub);
                    } catch (e) {
                        console.warn(`subscribe failed for ${destination}`, e);
                    }
                };

                subscribeSafe("/topic/trade", (data) => setTrades((prev) => [data, ...prev].slice(0, 10)));
                subscribeSafe("/topic/ticker", (data) =>
                    setTickers((prev) => ({ ...prev, [data.symbol]: data.price }))
                );
                subscribeSafe("/topic/orderbook", (data) => setOrderbooks((prev) => ({ ...prev, [data.symbol]: data })));
                subscribeSafe("/topic/candle", (data) => setCandles((prev) => ({ ...prev, [data.symbol]: data })));
            };

            client.onStompError = (frame) => {
                console.error("[Realtime] STOMP Error", frame);
                setError(frame.body || "STOMP error");
                setStatus("error");
            };

            client.onWebSocketClose = () => setStatus("disconnected");
            client.onWebSocketError = (evt) => {
                console.error("[Realtime] WS error", evt);
                setError(evt);
                setStatus("error");
            };

            client.activate();
            clientRef.current = client;
        };

        initWebSocket();

        return () => {
            subsRef.current.forEach((s) => {
                try { s.unsubscribe(); } catch {}
            });
            subsRef.current = [];

            if (clientRef.current) {
                try { clientRef.current.deactivate(); } catch {}
            }
            clientRef.current = null;
        };
    }, []);

    return (
        <div className="space-y-6 text-white">
            <h2 className="text-2xl font-bold">Realtime Data</h2>

            {/* 탭 */}
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

            {/* 심볼 필터 */}
            <div className="flex items-center gap-2">
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

            {/* 데이터 표시 */}
            <div className="bg-white/10 p-4 rounded-xl min-h-[150px]">
                {activeData === "trade" &&
                    trades.filter((t) => !selectedSymbol || displaySymbol(t.symbol).includes(selectedSymbol.toUpperCase()))
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
                                <div>Bid: {ob?.bid ? Number(ob.bid).toLocaleString() : "-"}</div>
                                <div>Ask: {ob?.ask ? Number(ob.ask).toLocaleString() : "-"}</div>
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

            <div className="mt-2 text-sm">
                Status: {status} {error && `| Error: ${error}`}
            </div>
        </div>
    );
}