# BPMN Collaboration Tool - Backend Server

실시간 BPMN 다이어그램 협업 도구의 백엔드 서버입니다.

## 기술 스택

- **Node.js** + **TypeScript**
- **Express.js** - REST API 서버
- **Socket.io** - 실시간 통신
- **MongoDB** - 메인 데이터베이스
- **Redis** - 세션 관리 및 캐싱

## 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정
`.env.example` 파일을 `.env`로 복사하고 필요한 값들을 설정하세요.

```bash
cp .env.example .env
```

### 3. 개발 서버 실행
```bash
npm run dev
```

### 4. 프로덕션 빌드
```bash
npm run build
npm start
```

## API 엔드포인트

### Health Check
- `GET /api/health` - 서버 상태 확인

### Users
- `GET /api/users` - 사용자 목록 조회
- `POST /api/users` - 사용자 생성
- `GET /api/users/:id` - 사용자 조회
- `PUT /api/users/:id` - 사용자 정보 업데이트

### Diagrams
- `GET /api/diagrams` - 다이어그램 목록 조회
- `POST /api/diagrams` - 다이어그램 생성
- `GET /api/diagrams/:id` - 다이어그램 조회
- `PUT /api/diagrams/:id` - 다이어그램 업데이트
- `DELETE /api/diagrams/:id` - 다이어그램 삭제
- `POST /api/diagrams/:id/collaborators` - 협업자 추가
- `DELETE /api/diagrams/:id/collaborators/:userId` - 협업자 제거

## Socket.io 이벤트

### 클라이언트 → 서버
- `authenticate` - 사용자 인증
- `join_diagram` - 다이어그램 룸 참여
- `leave_diagram` - 다이어그램 룸 떠나기
- `diagram_change` - 다이어그램 변경사항 전송
- `cursor_move` - 커서 위치 업데이트

### 서버 → 클라이언트
- `authenticated` - 인증 성공
- `auth_error` - 인증 실패
- `user_joined` - 새 사용자 참여
- `user_left` - 사용자 떠남
- `participants_updated` - 참가자 목록 업데이트
- `diagram_updated` - 다이어그램 업데이트
- `cursor_updated` - 커서 위치 업데이트
- `error` - 에러 메시지

## 데이터베이스 스키마

### User
- `username`: 사용자명 (고유)
- `email`: 이메일 (고유)
- `avatar`: 아바타 URL
- `isOnline`: 온라인 상태
- `lastSeen`: 마지막 접속 시간

### Diagram
- `title`: 다이어그램 제목
- `description`: 설명
- `bpmnXml`: BPMN XML 데이터
- `owner`: 소유자 ID
- `collaborators`: 협업자 ID 배열
- `isPublic`: 공개 여부
- `version`: 버전 번호

### CollaborationSession
- `diagramId`: 다이어그램 ID
- `participants`: 참가자 정보 배열
- `isActive`: 활성 상태

## 개발

### 테스트 실행
```bash
npm test
npm run test:watch
```

### 코드 포맷팅
프로젝트는 Prettier와 ESLint를 사용합니다.

### 환경 변수

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| PORT | 서버 포트 | 3001 |
| NODE_ENV | 환경 | development |
| MONGODB_URI | MongoDB 연결 URI | mongodb://localhost:27017/bpmn-collaboration |
| REDIS_HOST | Redis 호스트 | localhost |
| REDIS_PORT | Redis 포트 | 6379 |
| CORS_ORIGIN | CORS 허용 오리진 | http://localhost:3000 |