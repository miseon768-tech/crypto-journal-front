import { useEffect, useState } from "react";

export default function RealtimeComponent() {
    const [prices, setPrices] = useState({});

    useEffect(() => {
        const socket = new WebSocket("ws://localhost:8080/ws/price");

        socket.onopen = () => {
            console.log("소켓 연결됨");
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            // 예시: { symbol: "KRW-BTC", price: 72000000 }
            setPrices(prev => ({
                ...prev,
                [data.symbol]: data.price
            }));
        };

        socket.onerror = (err) => {
            console.log("소켓 에러", err);
        };

        socket.onclose = () => {
            console.log("소켓 종료");
        };

        return () => {
            socket.close();
        };
    }, []);

    return (
        <div>
            <h2>실시간 시세</h2>
            {Object.entries(prices).map(([symbol, price]) => (
                <div key={symbol}>
                    {symbol} : {price?.toLocaleString()}원
                </div>
            ))}
        </div>
    );
}