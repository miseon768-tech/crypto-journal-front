# EcoTory - Crypto Journal Frontend

## 프로젝트 개요
EcoTory 프론트엔드는 암호화폐 자산 관리, 실시간 시세, 커뮤니티, 포트폴리오, 알림 등 다양한 기능을 제공하는 React 기반의 Next.js SPA(싱글 페이지 애플리케이션)입니다.

## 주요 기능
- 회원가입/로그인 (JWT, OAuth 지원)
- 실시간 자산 시세, 거래쌍, 차트, 호가, 체결 정보 제공
- 커뮤니티(게시글, 댓글, 좋아요, 신고)
- 포트폴리오 및 자산 관리
- 관심코인, 알림 기능
- 백엔드 API 연동(REST, WebSocket)
- 반응형 UI, Tailwind CSS 적용

## 기술 스택
- Next.js 16
- React 19
- Zustand (상태관리)
- Chart.js, react-chartjs-2, lightweight-charts (차트)
- Axios (API 통신)
- STOMP, SockJS, ws (WebSocket)
- Tailwind CSS, PostCSS
- ESLint

## 환경설정
1. Node.js 18+ 권장
2. `.env.local` 파일에 백엔드 API 주소 등 환경변수 설정 (예시: `NEXT_PUBLIC_BACKEND_URL`)
3. 의존성 설치:
   ```bash
   npm install
   # 또는
   yarn install
   ```

## 실행 방법
```bash
npm run dev
# 또는
yarn dev
```
- 기본 개발 서버: [http://localhost:3000](http://localhost:3000)
- 실제 배포 서버 주소는 환경변수로 지정

## 빌드 및 배포
```bash
npm run build
npm start
```
- Vercel 등 다양한 플랫폼에 배포 가능

## API 연동
- 모든 데이터는 백엔드(Spring Boot) API와 연동
- REST, WebSocket(STOMP) 모두 지원
- 환경변수 `NEXT_PUBLIC_BACKEND_URL`로 API 주소 지정

## 기타
- 커스텀 컴포넌트: `components/` 폴더 참고
- 주요 페이지: `/pages/dashboard`, `/pages/login`, `/pages/signup` 등
- 환경별 민감정보는 별도 관리 필요
