"use client";

import { useEffect, useRef, useState } from "react";
import { getStoredToken } from "../api/member";

export default function RealtimeComponent() {
    // 기본을 ticker로 설정하여 빈 화면을 줄임
    const [activeData, setActiveData] = useState("ticker"); // 보여줄 데이터 타입
    const [trades, setTrades] = useState([]);
    const [tickers, setTickers] = useState({});
    const [orderbooks, setOrderbooks] = useState({});
    const [candles, setCandles] = useState({});

    const [status, setStatus] = useState("disconnected"); // connecting, connected, error
    const [error, setError] = useState(null);
    const [selectedSymbol, setSelectedSymbol] = useState("");

    const [rawMessages, setRawMessages] = useState([]); // 디버그용 원시 메시지

    const clientRef = useRef(null);
    const subsRef = useRef([]);
    const [connectKey, setConnectKey] = useState(0); // 변경 시 useEffect 재실행

    // 연결 상태가 바뀌면 기본 탭 유지
    useEffect(() => {
        if (status === "connected" && !activeData) {
            setActiveData("ticker");
        }
    }, [status, activeData]);

    useEffect(() => {
        // 환경 변수 또는 기본값
        const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080").replace(/\/$/, "");
        const possiblePaths = ["/ws"];
        let usedPath = "/ws";

        setStatus("connecting");
        setError(null);

        // helper to try connect with a given path
        const startClient = async (path) => {
            const wsUrl = `${BACKEND}${path}`;
            console.log('[Realtime] attempting SockJS connection to', wsUrl);

            // 토큰 확인: 없으면 연결 시도하지 않음
            const token = getStoredToken();
            if (!token) {
                console.warn('[Realtime] No token found in localStorage. Aborting websocket connect.');
                setError('로그인이 필요합니다. 다시 로그인해주세요.');
                setStatus('no-token');
                throw new Error('토큰 없음');
            }

            // 동적 import: SSR 환경에서 오류 방지
            let ClientModule, SockJSModule;
            try {
                const mods = await Promise.all([
                    import('@stomp/stompjs'),
                    import('sockjs-client')
                ]);
                ClientModule = mods[0];
                SockJSModule = mods[1];
            } catch (importErr) {
                console.error('Realtime: dynamic import failed', importErr);
                setError('Realtime 클라이언트 로드 실패. 콘솔 확인');
                setStatus('error');
                throw importErr;
            }

            const { Client } = ClientModule;
            const SockJS = SockJSModule && SockJSModule.default ? SockJSModule.default : SockJSModule;

            const connectHeaders = { Authorization: `Bearer ${token}` };
            console.log('[Realtime] connectHeaders:', { Authorization: connectHeaders.Authorization ? (connectHeaders.Authorization.substring(0,40) + '...') : null });

            const client = new Client({
                connectHeaders,
                webSocketFactory: () => new SockJS(wsUrl, null, { withCredentials: true }),
                reconnectDelay: 5000,
                heartbeatIncoming: 4000,
                heartbeatOutgoing: 4000,
                // debug: (msg) => console.debug('[STOMP DEBUG]', msg)
            });

            client.onWebSocketOpen = (ws) => {
                console.log('[Realtime] WebSocket opened', ws && ws.url ? ws.url : 'ws-open');
            };

            client.onConnect = (frame) => {
                console.log('[Realtime] STOMP connected', frame && frame.headers ? frame.headers : frame);
                setStatus('connected');
                setError(null);

                // clear previous subscriptions container
                subsRef.current = subsRef.current || [];

                const subscribeSafe = (destination, handler) => {
                    try {
                        const sub = client.subscribe(destination, (message) => {
                            try {
                                setRawMessages((r) => [message.body, ...r].slice(0, 20));
                                handler(message);
                            } catch (e) {
                                console.warn(`[Realtime] message handler parse error for ${destination}`, e);
                            }
                        });
                        console.log(`[Realtime] subscribed to ${destination}`);
                        subsRef.current.push(sub);
                    } catch (e) {
                        console.warn(`[Realtime] subscribe failed for ${destination}`, e);
                    }
                };

                subscribeSafe('/topic/trade', (message) => {
                    try {
                        const data = JSON.parse(message.body);
                        setTrades((prev) => [data, ...prev].slice(0, 10));
                    } catch (e) { console.warn('parse trade', e); }
                });

                subscribeSafe('/topic/ticker', (message) => {
                    try {
                        const data = JSON.parse(message.body);
                        setTickers((prev) => ({ ...prev, [data.symbol]: data.price }));
                    } catch (e) { console.warn('parse ticker', e); }
                });

                subscribeSafe('/topic/orderbook', (message) => {
                    try {
                        const data = JSON.parse(message.body);
                        setOrderbooks((prev) => ({ ...prev, [data.symbol]: data }));
                    } catch (e) { console.warn('parse orderbook', e); }
                });

                subscribeSafe('/topic/candle', (message) => {
                    try {
                        const data = JSON.parse(message.body);
                        setCandles((prev) => ({ ...prev, [data.symbol]: data }));
                    } catch (e) { console.warn('parse candle', e); }
                });
            };

            client.onStompError = (frame) => {
                console.error('[Realtime] STOMP error', frame);
                setError(frame && frame.body ? frame.body : 'STOMP error');
                setStatus('error');
            };

            client.onWebSocketClose = (evt) => {
                console.warn('[Realtime] WS closed', evt);
                setStatus('disconnected');
            };

            client.onWebSocketError = (evt) => {
                console.error('[Realtime] WS error', evt);
                setError(evt);
                setStatus('error');
            };

            try {
                client.activate();
            } catch (actErr) {
                console.error('Realtime: client.activate failed', actErr);
                setError('Realtime 연결 실패: 클라이언트 활성화 오류');
                setStatus('error');
                throw actErr;
            }

            clientRef.current = client;
            usedPath = path;
            return client;
        };

        // try connect sequentially until one succeeds
        let connected = false;
        let clientInstance = null;
        (async () => {
            for (const p of possiblePaths) {
                try {
                    clientInstance = await startClient(p);
                    // give it a short time to connect
                    await new Promise((res) => setTimeout(res, 800));
                    if (clientInstance && clientRef.current && clientRef.current.connected) {
                        connected = true;
                        break;
                    } else {
                        // deactivate and try next
                        try { clientInstance.deactivate(); } catch (e) {}
                    }
                } catch (e) {
                    console.warn('ws try failed', p, e);
                }
            }
            if (!connected) {
                setStatus("error");
                setError("WebSocket 연결 실패: 모든 경로 시도 완료");
            }
        })();

        return () => {
            // 구독 해제
            try {
                subsRef.current.forEach((s) => {
                    try { s.unsubscribe(); } catch (e) {}
                });
                subsRef.current = [];
            } catch (e) {}

            // 비활성화
            try {
                if (clientRef.current) {
                    clientRef.current.deactivate();
                }
            } catch (e) {}

            clientRef.current = null;
        };
    }, [connectKey]); // connectKey 변경 시 재실행

    const displaySymbol = (symbol) => {
        if (!symbol) return symbol;
        return String(symbol).toUpperCase();
    };

    return (
        <div className="space-y-6 text-white">
            <h2 className="text-2xl font-bold">Realtime Data</h2>

            {/* 큰 상태 배너 */}
            <div className="flex items-center gap-4">
                <div className="p-3 rounded bg-white/5">
                    <strong>Status:</strong> <span className="ml-2">{status}</span>
                    {error && <div className="text-red-400 mt-1">{String(error)}</div>}
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <button onClick={() => setConnectKey(k => k + 1)} className="px-3 py-2 bg-blue-600 rounded">Reconnect</button>
                    <button onClick={() => { setRawMessages([]); setTrades([]); setTickers({}); setOrderbooks({}); setCandles({}); }} className="px-3 py-2 bg-gray-600 rounded">Clear</button>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex gap-4 mb-4">
                    <button
                        onClick={() => setActiveData("trade")}
                        className={`px-4 py-2 rounded-lg ${activeData === "trade" ? "bg-indigo-500" : "bg-white/10"}`}
                    >
                        Trade
                    </button>
                    <button
                        onClick={() => setActiveData("ticker")}
                        className={`px-4 py-2 rounded-lg ${activeData === "ticker" ? "bg-indigo-500" : "bg-white/10"}`}
                    >
                        Ticker
                    </button>
                    <button
                        onClick={() => setActiveData("orderbook")}
                        className={`px-4 py-2 rounded-lg ${activeData === "orderbook" ? "bg-indigo-500" : "bg-white/10"}`}
                    >
                        Orderbook
                    </button>
                    <button
                        onClick={() => setActiveData("candle")}
                        className={`px-4 py-2 rounded-lg ${activeData === "candle" ? "bg-indigo-500" : "bg-white/10"}`}
                    >
                        Candle
                    </button>
                </div>

                <div className="ml-auto flex items-center gap-3">
                    <span className="text-sm text-gray-300">Active: {activeData}</span>
                </div>
            </div>

            {/* 필터 입력 */}
            <div className="flex items-center gap-2">
                <input
                    value={selectedSymbol}
                    onChange={(e) => setSelectedSymbol(e.target.value.trim())}
                    placeholder="심볼 필터 (예: BTC)"
                    className="px-3 py-2 rounded bg-gray-800"
                />
                <button onClick={() => setSelectedSymbol("")} className="px-3 py-2 rounded bg-white/10">Clear</button>
            </div>

            {/* 디버그: 카운트와 최근 원시 메시지 */}
            <div className="bg-white/5 p-3 rounded text-xs text-gray-300">
                <div>Trades: {trades.length} &nbsp; Tickers: {Object.keys(tickers).length} &nbsp; Orderbooks: {Object.keys(orderbooks).length} &nbsp; Candles: {Object.keys(candles).length}</div>
                <div className="mt-2">최근 원시 메시지:</div>
                <div className="max-h-40 overflow-auto mt-1">
                    {rawMessages.map((m, i) => (
                        <pre key={i} className="whitespace-pre-wrap text-[11px]">{m}</pre>
                    ))}
                </div>
            </div>

            {/* 데이터 표시 */}
            <div className="bg-white/10 p-4 rounded-xl min-h-[150px]">
                {!activeData && <div>버튼을 눌러 데이터를 확인하세요.</div>}

                {activeData === "trade" && trades.length === 0 && <div>체결 데이터가 없습니다.</div>}
                {activeData === "trade" &&
                    trades
                        .filter(t => !selectedSymbol || String(t.symbol).toUpperCase().includes(String(selectedSymbol).toUpperCase()))
                        .map((trade, idx) => (
                            <div key={idx} className="flex justify-between border-b border-white/10 py-1 text-sm">
                                <span>{displaySymbol(trade.symbol)}</span>
                                <span>{Number(trade.price).toLocaleString?.() ?? trade.price}원</span>
                                <span>{trade.quantity}</span>
                            </div>
                        ))}

                {activeData === "ticker" &&
                    Object.entries(tickers)
                        .filter(([symbol]) => !selectedSymbol || String(symbol).toUpperCase().includes(String(selectedSymbol).toUpperCase()))
                        .map(([symbol, price]) => (
                            <div key={symbol} className="flex justify-between border-b border-white/10 py-1 text-sm">
                                <span>{displaySymbol(symbol)}</span>
                                <span>{Number(price).toLocaleString?.() ?? price}원</span>
                            </div>
                        ))}

                {activeData === "orderbook" &&
                    Object.entries(orderbooks)
                        .filter(([symbol]) => !selectedSymbol || String(symbol).toUpperCase().includes(String(selectedSymbol).toUpperCase()))
                        .map(([symbol, ob]) => (
                            <div key={symbol} className="border-b border-white/10 py-1 text-sm">
                                <div>{displaySymbol(symbol)}</div>
                                <div>Bid: {ob?.bid ? Number(ob.bid).toLocaleString() : "-"}</div>
                                <div>Ask: {ob?.ask ? Number(ob.ask).toLocaleString() : "-"}</div>
                            </div>
                        ))}

                {activeData === "candle" &&
                    Object.entries(candles)
                        .filter(([symbol]) => !selectedSymbol || String(symbol).toUpperCase().includes(String(selectedSymbol).toUpperCase()))
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
