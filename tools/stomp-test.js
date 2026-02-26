import fetch from 'node-fetch';
import { Client } from '@stomp/stompjs';
import WebSocket from 'ws';

const BACKEND = process.env.BACKEND || 'http://43.201.97.58:8081';
const WS_HOST = (process.env.BACKEND_WS || 'ws://43.201.97.58:8081') + '/ws/websocket';
const EMAIL = process.env.TEST_EMAIL || 'merujens@naver.com';
const PASS = process.env.TEST_PASS || 'Miseon8976!';

async function loginAndGetToken() {
  const res = await fetch(`${BACKEND}/api/member/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const json = await res.json();
  if (!json || !json.token) throw new Error('login failed or token missing: ' + JSON.stringify(json));
  return json.token;
}

(async () => {
  try {
    console.log('Logging in...');
    const token = await loginAndGetToken();
    console.log('Got token len=', token.length);

    console.log('Connecting to', WS_HOST);

    const client = new Client({
      webSocketFactory: () => new WebSocket(WS_HOST),
      connectHeaders: { Authorization: `Bearer ${token}` },
      debug: (str) => console.log('[STOMP DEBUG]', str),
      reconnectDelay: 5000,
    });

    client.onConnect = (frame) => {
      console.log('STOMP CONNECTED', frame.headers);
      const sub = client.subscribe('/topic/ticker', (msg) => {
        console.log('[MSG] topic/ticker', msg.body);
      });

      setTimeout(() => {
        console.log('Disconnecting after 6s');
        sub.unsubscribe();
        client.deactivate();
        process.exit(0);
      }, 6000);
    };

    client.onStompError = (frame) => {
      console.error('STOMP ERROR', frame);
      process.exit(1);
    };

    client.activate();
  } catch (e) {
    console.error('TEST ERROR', e);
    process.exit(1);
  }
})();

