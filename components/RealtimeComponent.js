"use client";

import {useEffect, useRef, useState} from "react";
import {getStoredToken} from "../api/member";

export default function RealtimeComponent() {
    const [activeData, setActiveData] = useState("ticker");
    const [trades, setTrades] = useState([]);
    const [tickers, setTickers] = useState({});
    const [orderbooks, setOrderbooks] = useState({});
    const [candles, setCandles] = useState({});
    const [status, setStatus] = useState("disconnected");
    const [error, setError] = useState(null);
    const [selectedSymbol, setSelectedSymbol] = useState("");
    const [clientStatus, setClientStatus] = useState({ active: false, connected: false, subs: 0 });

    // 디버깅 메시지(화면에 출력) - 최근 40개
    const [debugMessages, setDebugMessages] = useState([]);

    const clientRef = useRef(null);
    const subsRef = useRef([]);
    const subscribedDestRef = useRef(new Set());
    const triedFallbackRef = useRef(false);
    const heartbeatLoggerRef = useRef(null);
    const lastMessageAtRef = useRef(null);
    const fallbackWatcherRef = useRef(null);
    const fallbackAutoInjectRef = useRef(null);

    const displaySymbol = (symbol) => (symbol ? String(symbol).toUpperCase() : symbol);

    // helper: snake_case 키를 camelCase로 변환 (얕은 변환)
    const snakeToCamel = (s) => s.replace(/_([a-z])/g, (m, p1) => p1.toUpperCase());

    const normalizeKeysToCamel = (obj) => {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
        const out = {};
        Object.keys(obj).forEach((k) => {
            const v = obj[k];
            const nk = snakeToCamel(k);
            // 재귀적으로 객체 내부의 키도 정규화
            if (v && typeof v === 'object' && !Array.isArray(v)) {
                out[nk] = normalizeKeysToCamel(v);
            } else {
                out[nk] = v;
            }
        });
        return out;
    };

    const pushDebug = (msg) => {
        console.debug(msg);
        setDebugMessages((prev) => [String(msg)].concat(prev).slice(0, 40));
    };

    // 포맷 유틸: timestamp -> HH:MM:SS
    const formatTime = (ts) => {
        if (!ts) return '-';
        try {
            const d = new Date(ts);
            return d.toLocaleTimeString();
        } catch (e) { return String(ts); }
    };

    // 개발용: 데모 데이터 주입 (화면 확인용)
    const injectDemoData = () => {
        lastMessageAtRef.current = Date.now();
        pushDebug('Injecting demo data');
        setTickers((prev) => ({...prev, DEMO_BTC: 12345678}));
        setTrades((prev) => [{ symbol: 'BTC/KRW', price: 12345678, quantity: 0.01 }, ...prev].slice(0, 10));
        setOrderbooks((prev) => ({...prev, DEMO_BTC: { bid: 100, ask: 200 }}));
        setCandles((prev) => ({...prev, DEMO_BTC: { open: 12000000, close: 12345678, high: 12500000, low: 11900000 }}));
    };

    const handleReload = () => {
        // 빠른 재시도: 전체 페이지 새로고침
        pushDebug('User requested reload to re-init websocket');
        window.location.reload();
    };

    useEffect(() => {
        // 주기적으로 client 상태를 기록 (디버깅 보조)
        heartbeatLoggerRef.current = setInterval(() => {
            const c = clientRef.current;
            if (c) {
                try {
                    const st = { active: !!c.active, connected: !!c.connected, subs: subsRef.current.length };
                    setClientStatus(st);
                    pushDebug(`[CLIENT STATUS] active=${st.active} connected=${st.connected} subs=${st.subs}`);
                } catch (e) {
                    // ignore
                }
            }
        }, 8000);

        const initWebSocket = async () => {
                // 이미 활성화된 클라이언트가 있으면 중복 초기화 방지
                if (clientRef.current && clientRef.current.active) {
                    pushDebug('initWebSocket: client already active - skipping init');
                    return;
                }

            const token = getStoredToken();
            if (!token) {
                // 계속 진행하되 데모/폴백 모드로 동작
                pushDebug("No token found - running in demo/fallback mode (no STOMP auth). Some endpoints may require auth.");
                setStatus("no-token");
            }

            const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080").replace(/\/$/, "");
            const wsPlain = BACKEND.replace(/^http/, 'ws') + '/ws/websocket';
            const sockUrl = `${BACKEND}/ws`;

            let Client, SockJS;

            try {
                Client = (await import("@stomp/stompjs")).Client;
                SockJS = (await import("sockjs-client")).default;
            } catch (e) {
                console.error("Realtime client import failed", e);
                setError("Realtime 클라이언트 로드 실패");
                setStatus("error");
                pushDebug(`import failed: ${e}`);
                return;
            }

            // 토큰 디버그: 토큰이 문자열인지, 길이는 적절한지 확인
            try {
                const t = String(token || '');
                pushDebug(`Realtime token len=${t.length} head=${t.slice(0,8)} tail=${t.slice(-8)}`);
            } catch (e) { pushDebug(`token stringify failed: ${e}`); }

            const setupClient = (webSocketFactory, transportName = 'sockjs') => {
                const client = new Client({
                    webSocketFactory,
                    connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
                    reconnectDelay: 5000,
                    heartbeatIncoming: 4000,
                    heartbeatOutgoing: 4000,
                    // debug 콜백: 화면과 콘솔에 모두 남김
                    debug: (msg) => pushDebug(`[STOMP][${transportName}] ${msg}`),
                });

                client.onConnect = () => {
                    pushDebug(`[STOMP][${transportName}] Connected`);
                    console.log("[Realtime] STOMP Connected!");
                    setStatus("connected");
                    setError(null);
                    setClientStatus((s) => ({...s, active: true, connected: true}));

                    // 구독 헬퍼
                    const subscribeSafe = (destination, handler) => {
                        try {
                            // 구독 중복 방지: 이미 같은 destination 구독시 skip
                            if (subscribedDestRef.current.has(destination)) {
                                pushDebug(`subscribeSafe: already subscribed ${destination} - skip`);
                                return;
                            }
                            const sub = client.subscribe(destination, (msg) => {
                                try {
                                    const raw = msg && msg.body ? msg.body : '';
                                    pushDebug(`[MSG RAW][${destination}] len=${raw ? raw.length : 0} preview=${String(raw).slice(0,200)}`);
                                    let parsed;
                                    try {
                                        parsed = raw ? JSON.parse(raw) : raw;
                                    } catch (pe) {
                                        pushDebug(`[MSG PARSE FAILED][${destination}] ${pe}`);
                                        parsed = raw; // fallback: deliver raw string
                                    }
                                    // 메시지 수신 시각 업데이트
                                    lastMessageAtRef.current = Date.now();
                                    // 정규화: snake_case를 camelCase로 변환해 핸들러에 전달
                                    const normalized = (parsed && typeof parsed === 'object') ? normalizeKeysToCamel(parsed) : parsed;
                                    handler(normalized);
                                } catch (e) {
                                    console.warn(`subscribe handler error for ${destination}`, e);
                                    pushDebug(`subscribe handler error ${destination}: ${e}`);
                                }
                            });
                            subsRef.current.push(sub);
                            subscribedDestRef.current.add(destination);
                            pushDebug(`subscribed ${destination}`);
                            setClientStatus((s) => ({...s, subs: subsRef.current.length}));
                        } catch (e) {
                            console.warn(`subscribe failed for ${destination}`, e);
                            pushDebug(`subscribe failed ${destination}: ${e}`);
                        }
                    };

                    subscribeSafe("/topic/trade", (data) => {
                        pushDebug(`received trade ${JSON.stringify(data).slice(0,200)}`);
                        const trade = {
                            symbol: data.market,
                            price: data.tradePrice,
                            quantity: data.tradeVolume,
                        };
                        setTrades((prev) => [trade, ...prev].slice(0, 10))
                    });

                    subscribeSafe("/topic/ticker", (data) => {
                        const ticker = {
                            symbol: data.code,
                            price: data.tradePrice,
                        };
                        setTickers((prev) => ({...prev, [ticker.symbol]: ticker.price}));
                    });

                    subscribeSafe("/topic/orderbook", (data) => {
                        const ob = {
                            bid: data.totalBidSize,
                            ask: data.totalAskSize,
                        };
                        setOrderbooks((prev) => ({...prev, [data.code]: ob}));
                    });

                    subscribeSafe("/topic/candle", (data) => {
                        const candle ={
                            open: data.openingPrice,
                            close: data.tradePrice,
                            high: data.highPrice,
                            low: data.lowPrice,
                        }
                        setCandles((prev) => ({...prev, [data.market]: candle}))
                    });
                };

                client.onStompError = (frame) => {
                    console.error("[Realtime] STOMP Error", frame);
                    pushDebug(`[STOMP][${transportName}] STOMP ERROR: ${frame && frame.body ? frame.body : JSON.stringify(frame)}`);
                    setError(frame && frame.body ? frame.body : "STOMP error");
                    setStatus("error");
                    setClientStatus((s) => ({...s, connected: false}));
                };

                client.onWebSocketClose = (evt) => {
                    pushDebug(`[STOMP][${transportName}] websocket closed: ${evt && evt.code ? evt.code : JSON.stringify(evt)}`);
                    setStatus("disconnected");
                    setClientStatus((s) => ({...s, active: false, connected: false}));
                };

                client.onWebSocketError = (evt) => {
                    console.error("[Realtime] WS error", evt);
                    pushDebug(`[STOMP][${transportName}] WS error: ${String(evt)}`);
                    setError(evt);
                    setStatus("error");

                    // 추가 로깅: client 내부 상태
                    try {
                        const c = clientRef.current;
                        pushDebug(`[WS ERROR] client.active=${c?.active} client.connected=${c?.connected} subs=${subsRef.current.length}`);
                    } catch (e) { pushDebug(`[WS ERROR] client introspect failed: ${e}`); }

                    // fallback: SockJS 실패시 한 번만 plain WebSocket으로 재시도
                    if (!triedFallbackRef.current && transportName === 'sockjs') {
                        triedFallbackRef.current = true;
                        pushDebug('Attempting fallback to plain WebSocket...');
                        try {
                            // deactivate current client gracefully
                            try { client.deactivate(); } catch (e) { /*ignore*/ }
                        } catch (e) {}
                        // create plain ws client
                        const wsFactory = () => new WebSocket(wsPlain);
                        const plainClient = setupClient(wsFactory, 'ws-plain');
                        clientRef.current = plainClient;
                        plainClient.activate();
                    }
                };

                return client;
            };

            // 사전 검사: SockJS /info 엔드포인트 상태 확인 (디버그용)
            try {
                const infoUrl = `${sockUrl}/info`;
                pushDebug(`Probing SockJS info -> ${infoUrl}`);
                // 주의: /info 엔드포인트에 인증 헤더를 붙이면 일부 서버에서 401을 반환할 수 있으므로
                // 프로브에는 인증 헤더를 제거합니다. 실제 STOMP CONNECT는 connectHeaders로 토큰을 보냅니다.
                const probeRes = await fetch(infoUrl, { method: 'GET' }).catch((e) => {
                    pushDebug(`SockJS info fetch failed: ${String(e)}`);
                    return null;
                });
                if (probeRes) {
                    pushDebug(`SockJS info status: ${probeRes.status}`);
                    const txt = await probeRes.text().catch(() => null);
                    if (txt) pushDebug(`SockJS info body: ${txt.slice(0,200)}`);
                }
            } catch (e) {
                pushDebug(`SockJS probe exception: ${String(e)}`);
            }

            // 1) 우선 SockJS로 시도
            const sockFactory = () => {
                const sock = new SockJS(sockUrl);
                // 브라우저에서 발생하는 에러/close를 잡아 디버그에 남김
                try {
                    sock.onopen = () => pushDebug(`SockJS socket onopen`);
                    sock.onclose = (e) => pushDebug(`SockJS socket onclose code=${e?.code} reason=${e?.reason || ''}`);
                    sock.onerror = (e) => pushDebug(`SockJS socket onerror: ${String(e)}`);
                } catch (e) {
                    // 일부 환경에서 sock 이벤트 프로퍼티가 없을 수 있음
                    pushDebug(`attach sock handlers failed: ${e}`);
                }
                return sock;
            };
            const sockClient = setupClient(sockFactory, 'sockjs');
            clientRef.current = sockClient;
            try {
                sockClient.activate();
                pushDebug(`Connecting SockJS -> ${sockUrl}`);
                // 메시지 무수신 검사: 10초 동안 메시지가 없으면 디버그 경고
                setTimeout(() => {
                    try {
                        const last = lastMessageAtRef.current;
                        if (!last || (Date.now() - last) > 10000) {
                            pushDebug('No realtime messages received yet (10s) - backend may not be pushing data');
                            setStatus((s) => s === 'connected' ? 'connected-no-data' : s);
                            // START fallback polling when no realtime data
                            startFallbackPolling();
                        }
                    } catch (e) { /* ignore */ }
                }, 10000);
            } catch (e) {
                pushDebug(`SockJS activate failed: ${e}`);
                // 즉시 fallback
                if (!triedFallbackRef.current) {
                    triedFallbackRef.current = true;
                    const wsFactory = () => {
                        const ws = new WebSocket(wsPlain);
                        try {
                            ws.onopen = () => pushDebug('WS socket onopen');
                            ws.onclose = (ev) => pushDebug(`WS socket onclose code=${ev?.code} reason=${ev?.reason || ''}`);
                            ws.onerror = (ev) => pushDebug(`WS socket onerror: ${String(ev)}`);
                        } catch (e) {
                            pushDebug(`attach ws handlers failed: ${e}`);
                        }
                        return ws;
                     };
                     const plainClient = setupClient(wsFactory, 'ws-plain');
                     clientRef.current = plainClient;
                     plainClient.activate();
                     pushDebug(`Connecting WS -> ${wsPlain}`);
                 }
             }

            // --- Fallback polling: if no STOMP messages, poll market list and Upbit public ticker API ---
            const marketsPollRef = { current: null };

            const fetchMarketsAndPrices = async () => {
                try {
                    const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080').replace(/\/$/, '');
                    pushDebug('Fallback: fetching market list from backend');

                    const token = getStoredToken();
                    const res = await fetch(`${BACKEND}/api/market/all`, {
                        method: 'GET',
                        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                    });                    const json = await res.json().catch(() => null);
                    
                    pushDebug(`Fallback: market list raw: ${JSON.stringify(json).slice(0,200)}`);

                    // try to extract markets array
                    let markets = null;
                    if (Array.isArray(json)) markets = json;
                    else if (json && Array.isArray(json.data)) markets = json.data;
                    else if (json && Array.isArray(json.markets)) markets = json.markets;
                    else if (json && Array.isArray(json.tradingPairs)) markets = json.tradingPairs;

                    if (!markets || markets.length === 0) {
                        pushDebug('Fallback: no markets found from backend');
                        return;
                    }

                    // extract market codes (e.g., KRW-BTC or BTC/KRW depending on backend). Normalize to Upbit format KRW-BTC
                    const codes = markets.slice(0, 20).map((m) => {
                        if (!m) return null;
                        if (typeof m === 'string') return m;
                        // try common fields
                        return m.market || m.code || m.marketCode || m.name || null;
                    }).filter(Boolean).slice(0, 20);

                    if (codes.length === 0) return;

                    // Upbit expects markets as KRW-BTC etc. Ensure format: if code contains '/', convert
                    const upbitCodes = codes.map(c => c.includes('/') ? c.replace('/', '-') : c).slice(0, 10);
                    const upbitApi = `https://api.upbit.com/v1/ticker?markets=${upbitCodes.join(',')}`;
                    pushDebug(`Fallback: querying Upbit for ${upbitCodes.join(',')}`);
                    const up = await fetch(upbitApi).catch(() => null);
                    if (!up || !up.ok) {
                        pushDebug('Fallback: Upbit API failed or CORS blocked');
                        // as fallback, show markets with placeholder prices
                        const placeholderTickers = {};
                        codes.forEach((c, i) => { if (i < 20) placeholderTickers[c] = null; });
                        setTickers((prev) => ({...prev, ...placeholderTickers}));
                        return;
                    }
                    const upJson = await up.json();
                    const newTickers = {};
                    if (Array.isArray(upJson)) {
                        upJson.forEach((item) => {
                            // item.market like 'KRW-BTC', item.trade_price
                            const key = item.market || item.code || item.marketCode;
                            newTickers[key] = item.trade_price || item.tradePrice || null;
                        });
                    }
                    setTickers((prev) => ({...prev, ...newTickers}));
                    pushDebug(`Fallback: updated tickers from Upbit: ${Object.keys(newTickers).length}`);

                } catch (e) {
                    pushDebug(`Fallback fetchMarketsAndPrices error: ${e}`);
                }
            };

            const startFallbackPolling = () => {
                if (marketsPollRef.current) return; // already polling
                pushDebug('Starting fallback polling every 10s');
                // run immediately then every 10s
                fetchMarketsAndPrices();
                marketsPollRef.current = setInterval(fetchMarketsAndPrices, 10000);
                // schedule auto demo injection if no real data arrives shortly
                try { if (fallbackAutoInjectRef.current) clearTimeout(fallbackAutoInjectRef.current); } catch(e){}
                fallbackAutoInjectRef.current = setTimeout(() => {
                    try {
                        if ((Object.keys(tickers).length === 0) && trades.length === 0) {
                            pushDebug('Auto-injecting demo data because no fallback data arrived');
                            injectDemoData();
                        }
                    } catch(e){}
                }, 6000);
            };

            const stopFallbackPolling = () => {
                try { if (marketsPollRef.current) clearInterval(marketsPollRef.current); } catch (e) {}
                marketsPollRef.current = null;
                pushDebug('Stopped fallback polling');
                try { if (fallbackWatcherRef.current) clearInterval(fallbackWatcherRef.current); } catch(e){}
                fallbackWatcherRef.current = null;
                try { if (fallbackAutoInjectRef.current) clearTimeout(fallbackAutoInjectRef.current); } catch(e){}
                fallbackAutoInjectRef.current = null;
            };

            // stop fallback when realtime messages resume
            // we already update lastMessageAtRef on message; watch for that in interval to stop polling
            try { if (fallbackWatcherRef.current) clearInterval(fallbackWatcherRef.current); } catch(e){}
            fallbackWatcherRef.current = setInterval(() => {
                try {
                    const last = lastMessageAtRef.current;
                    if (last && (Date.now() - last) < 10000) {
                        // recent message arrived — stop fallback
                        stopFallbackPolling();
                        try { clearInterval(fallbackWatcherRef.current); } catch(e){}
                        fallbackWatcherRef.current = null;
                    }
                } catch (e) {}
            }, 3000);

             // expose stopFallbackPolling to cleanup
             sockClient.__stopFallbackPolling = stopFallbackPolling;

        };

        initWebSocket();

        return () => {
            // cleanup websocket subscriptions and client
            subsRef.current.forEach((s) => {
                try {
                    s.unsubscribe();
                } catch {
                }
            });
            subsRef.current = [];
            subscribedDestRef.current.clear();

            if (clientRef.current) {
                try {
                    clientRef.current.deactivate();
                } catch {
                }
            }
            // ensure fallback polling stopped on cleanup
            try { if (clientRef.current && clientRef.current.__stopFallbackPolling) clientRef.current.__stopFallbackPolling(); } catch (e) {}
            try { if (fallbackWatcherRef.current) clearInterval(fallbackWatcherRef.current); } catch(e){}
            try { if (fallbackAutoInjectRef.current) clearTimeout(fallbackAutoInjectRef.current); } catch(e){}
             clientRef.current = null;

             // cleanup heartbeat interval
             if (heartbeatLoggerRef.current) clearInterval(heartbeatLoggerRef.current);
         };
     }, []);

    return (
        <div className="space-y-6 text-white">
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
                Status: {status} {error && `| Error: ${String(error)}`}
            </div>

            <div className="text-sm text-gray-300">
                Client: active={String(clientStatus.active)} connected={String(clientStatus.connected)} subs={clientStatus.subs}
                <span className="ml-4">Counts: trades={trades.length} tickers={Object.keys(tickers).length} orderbooks={Object.keys(orderbooks).length} candles={Object.keys(candles).length}</span>
            </div>

            <div className="text-xs text-gray-400 mt-1">
                Last message: {formatTime(lastMessageAtRef.current)}
                {status === 'connected-no-data' && (
                    <span className="ml-3 text-yellow-300">서버에서 실시간 데이터를 보내지 않고 있습니다. (백엔드 확인 필요)</span>
                )}
            </div>

            <div className="flex gap-2 mt-2">
                <button onClick={injectDemoData} className="px-3 py-1 bg-green-600 rounded text-xs">데모 데이터 주입</button>
                <button onClick={handleReload} className="px-3 py-1 bg-blue-600 rounded text-xs">재시도(새로고침)</button>
            </div>

            {/* 디버그 창 */}
            <div className="mt-4 bg-black/40 p-2 rounded text-xs max-h-40 overflow-auto">
                <div className="font-semibold mb-1">Realtime debug</div>
                {debugMessages.length === 0 && <div className="text-gray-400">No debug messages yet</div>}
                {debugMessages.map((m, i) => (
                    <div key={i} className="py-0.5 border-b border-white/5">{m}</div>
                ))}
            </div>
        </div>
    );

}
