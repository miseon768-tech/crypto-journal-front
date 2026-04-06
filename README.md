
# EcoTory (Crypto Journal) - Frontend

실시간 암호화폐 시세 기반 자산/포트폴리오 관리 및 커뮤니티 기능을 제공하는 **EcoTory** 프론트엔드(Next.js) 입니다.

- 기간: **2025.12.30 ~ 2026.01.18**, **2026.02.19 ~ 2026.02.26** (분할 진행)
- 형태: **1인 프로젝트**

---

## 한눈에 보기
- 기술: Next.js 16, React 19, Zustand, Axios, STOMP.js + SockJS, Tailwind CSS
- 역할: UI/UX, 인증(로그인/소셜), REST API 소비, STOMP 기반 실시간 수신

자세한 아키텍처는 루트 `docs/architecture.md` 및 `../docs/architecture.md`(프로젝트 전체)를 참조하세요.

---

## 요구사항
- Node.js (권장 v20)
- npm 또는 yarn

## 환경변수
프로젝트 루트 또는 `crypto-journal-front/.env.local`에 설정합니다.

- `NEXT_PUBLIC_BACKEND_URL` (예: `http://localhost:8080`) — 프론트에서 REST 및 WebSocket 연결에 사용하는 백엔드 기본 URL
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_REDIRECT_URI` — 구글 로그인용 클라이언트 ID / 콜백 URI
- `NEXT_PUBLIC_NAVER_CLIENT_ID`, `NEXT_PUBLIC_NAVER_REDIRECT_URI` — 네이버 로그인용 클라이언트 ID / 콜백 URI
- `NEXT_PUBLIC_KAKAO_CLIENT_ID`, `NEXT_PUBLIC_KAKAO_REDIRECT_URI` — 카카오 로그인용 REST API 키 / 콜백 URI

개발 및 테스트용 도구(`tools/stomp-test.js`)에서 추가 환경변수를 사용합니다. 하드코딩된 URL이 없는지 확인하세요.

---

## 로컬 실행 (개발)
```bash
npm ci
npm run dev
```

- 개발 서버: http://localhost:3000

`.env.local` 예시:

```
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=http://localhost:3000/google/callback
NEXT_PUBLIC_NAVER_CLIENT_ID=your-naver-client-id
NEXT_PUBLIC_NAVER_REDIRECT_URI=http://localhost:3000/naver/callback
NEXT_PUBLIC_KAKAO_CLIENT_ID=your-kakao-rest-api-key
NEXT_PUBLIC_KAKAO_REDIRECT_URI=http://localhost:3000/kakao/callback
```

소셜 로그인 공급자 콘솔에는 위 콜백 URI를 **정확히 동일하게** 등록해야 합니다.

- 로컬 개발 시: `http://localhost:3000/google/callback`, `http://localhost:3000/naver/callback`, `http://localhost:3000/kakao/callback`
- 배포 환경 시: `http://3.36.109.46.nip.io:3000/google/callback`, `http://3.36.109.46.nip.io:3000/naver/callback`, `http://3.36.109.46.nip.io:3000/kakao/callback`

특히 Kakao는 `redirect_uri`가 한 글자라도 다르면 인가 코드를 발급하지 않습니다.

---

## 빌드 / 프로덕션
```bash
npm run build
npm run start
```

Docker 이미지 빌드:

```bash
docker build -t crypto-journal-front:latest -f Dockerfile .
docker run -e NEXT_PUBLIC_BACKEND_URL='http://localhost:8080' -p 3000:3000 crypto-journal-front:latest
```

---

## WebSocket (STOMP) 연결
- 프론트는 백엔드의 STOMP endpoint(`/ws`)에 SockJS + STOMP로 연결합니다.
- STOMP 연결 시 서버가 인증을 요구하면 CONNECT 단계에 `Authorization: Bearer <token>` 헤더를 전송해야 합니다.

예시 (stompjs):

```js
const socket = new SockJS(`${process.env.NEXT_PUBLIC_BACKEND_URL}/ws`);
const client = Stomp.over(socket);
const headers = { Authorization: `Bearer ${accessToken}` };
client.connect(headers, onConnect, onError);
```

프론트에서 `/ws/info`가 403이면 백엔드의 CORS / allowedOrigin 설정을 먼저 확인하세요.

---

## 트러블슈팅
- WebSocket 403: 백엔드의 `allowedOriginPatterns`에 현재 Origin(포트 포함)이 포함되어 있는지 확인
- 잘못된 API 주소: `NEXT_PUBLIC_BACKEND_URL` 값이 로컬이 아닌 배포 주소로 하드코딩되어 있는지 확인
- 인증 오류: 클라이언트 측에서 `Authorization` 헤더가 올바르게 설정되어 있는지 확인
- Kakao `KOE205`: 카카오 개발자 콘솔의 동의항목에 없는 scope를 요청한 경우입니다. 현재 프론트는 `profile_nickname`만 요청하므로, 이메일이 필요하면 콘솔에서 `account_email` 동의항목을 활성화한 뒤 프론트 요청 scope도 함께 맞추세요.
- Kakao 리디렉트/토큰 오류: 카카오 콘솔의 **REST API 키**와 프론트의 `NEXT_PUBLIC_KAKAO_CLIENT_ID`가 같아야 합니다. 또 콘솔에서 **클라이언트 시크릿이 활성화**되어 있다면 백엔드에도 `KAKAO_CLIENT_SECRET`를 반드시 주입해야 토큰 교환이 성공합니다.

---

## 개발 참고
- WebSocket 테스트 스크립트: `tools/stomp-test.js`
- 주요 컴포넌트: `components/`, `pages/dashboard`, `pages/login`, `pages/signup`

---

## 라이선스
개인 포트폴리오/학습 목적 프로젝트입니다.

