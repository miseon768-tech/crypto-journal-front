# EcoTory (Crypto Journal) - Frontend

실시간 암호화폐 시세 기반 자산/포트폴리오 관리 및 커뮤니티 기능을 제공하는 **EcoTory** 프론트엔드(Next.js) 입니다.

- 기간: **2025.12.30 ~ 2026.01.18**, **2026.02.19 ~ 2026.02.26** (분할 진행)
- 형태: **1인 프로젝트**

---

## 프로젝트 개요
EcoTory 프론트엔드는 암호화폐 자산 관리, 실시간 시세, 커뮤니티, 포트폴리오, 알림 등 다양한 기능을 제공하는 React 기반의 Next.js 웹 애플리케이션입니다.

---

## 주요 기능
- 회원가입/로그인 (JWT, OAuth 지원)
- 실시간 시세/호가/체결/차트 조회 및 UI 반영
- 커뮤니티(게시글, 댓글, 좋아요, 신고)
- 포트폴리오 및 자산 관리
- 관심코인
- 백엔드 API 연동(REST, WebSocket)

---

## 기술 스택
- Next.js 16
- React 19
- Zustand (상태관리)
- Axios (API 통신)
- STOMP.js + SockJS (WebSocket)
- Tailwind CSS, PostCSS
- Chart.js / lightweight-charts

---

## 환경 변수
`.env.local`에 백엔드 주소 등을 지정합니다.

- `NEXT_PUBLIC_BACKEND_URL` (예: `http://localhost:8080` 또는 `http://3.36.109.46.nip.io:8080`)
- 필요 시 OAuth 관련 값은 백엔드에서 처리(redirect-uri는 백엔드 프로파일에 의해 결정)

---

## 실행 방법 (로컬)
```bash
npm install
npm run dev
```
- 기본 개발 서버: http://localhost:3000
- 3000 포트가 점유 중이면 Next가 자동으로 3000 등 다른 포트를 사용합니다.

---

## 빌드/실행 (배포)
```bash
npm run build
npm run start
```

---

## 트러블슈팅 메모
### 1) WebSocket 연결이 계속 403으로 실패할 때
브라우저에서 아래처럼 보이면:
- `GET http://<host>:8080/ws/info ... 403 (Forbidden)`

대부분 원인은 다음 중 하나입니다.
- 백엔드 WebSocket endpoint의 `allowedOriginPatterns`에 **현재 접속 중인 프론트 Origin(포트 포함)** 이 빠짐
- Spring Security에서 `/ws/**` 경로가 permit 처리되지 않음

### 2) 로컬 테스트 중인데 AWS로 연결되는 문제
웹소켓/REST 대상 주소가 하드코딩되어 있으면 로컬에서 테스트해도 배포 서버로 붙을 수 있습니다.
- 해결: 프론트는 `NEXT_PUBLIC_BACKEND_URL` 기반으로만 서버 주소를 만들고, dev/prod에 따라 `.env.local` 값을 바꿔서 테스트합니다.

---

## 기타
- 커스텀 컴포넌트: `components/`
- 주요 페이지: `/pages/dashboard`, `/pages/login`, `/pages/signup`
