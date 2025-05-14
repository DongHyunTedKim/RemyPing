# RemyPing

## 0. 프로젝트 구조

src/
├── routes/ - 페이지와 레이아웃 파일 위치
│ ├── +page.svelte - 메인 페이지 (실제 UI 구현)
│ └── +layout.svelte - 공통 레이아웃 (모든 페이지에 적용)
├── app.css - 전역 스타일 (Tailwind CSS 설정)
└── lib/ - 재사용 가능한 컴포넌트나 유틸리티

## 1. 개요

- **서비스 이름**: RemyPing
- **목적**: 디즈니랜드 파리 "Bistrot Chez Rémy" 레스토랑의 예약 가능 여부를 실시간(주기적)으로 모니터링하고, 사용자가 설정한 알림 채널과 브라우저 화면에 즉시 알려줌으로써 취소표를 빠르게 잡을 수 있도록 지원

## 2. 기능 요구사항

### 2.1 스크레이핑

- **대상 페이지**: 디즈니랜드 파리 공식 예약 시스템의 "Bistrot Chez Rémy" 예약 페이지
- **확인 항목**: 사용자가 지정한 날짜(date)와 시간대(time slot)에 "예약 가능" 상태 여부
- **방식**: Playwright를 이용한 Headless Browser 제어로, 동적 로딩되는 콘텐츠까지 안정적으로 파싱
- **주기**: 환경변수 `CHECK_INTERVAL_MIN`(분 단위)로 설정

### 2.2 내부 API 라우트 (서비스 엔드포인트)

- **라우트**: `POST /api/check`
- **입력 파라미터**:

  - `date` (string, YYYY-MM-DD)
  - `time_slot` (string, e.g. 'lunch' or 'dinner')
  - `number_of_guests` (number, 기본값: 2, 예약할 인원 수)

- **출력**:

  - `available` (boolean)
  - `slots` (array of { time: string, link: string }) // 가능한 시간대 목록

- **에러 코드**:

  - 400: 입력 파라미터 누락/형식 오류
  - 500: 스크레이핑 실패 또는 내부 오류

- **참고**: 디즈니랜드 파리 예약 페이지는 공식 API를 제공하지 않으므로, Playwright 기반 스크레이핑 결과를 반환하는 내부 엔드포인트입니다.

### 2.3 알림 기능

- **Discord Webhook 알림**:

  - **장점**: 설정이 간단하고 무료이며, 임베드(Embed) 형태로 풍부한 정보를 전달 가능
  - **단점**: Discord 계정 및 채널이 필요하며, 메시지 전송 지연이 발생할 수 있음
  - **설정**: 환경변수 `DISCORD_WEBHOOK_URL`에 웹훅 URL 저장
  - **내용 예시**:

    ```json
    {
    	"embeds": [
    		{
    			"title": "[RemyPing] 예약 가능: ${date} ${time_slot}",
    			"description": "가능 슬롯: ${slots.map(s => s.time).join(', ')}",
    			"url": "${slots[0].link}"
    		}
    	]
    }
    ```

- **화면 알림**:

  - SvelteKit 프런트엔드에서 svelte-toast 사용
  - 예약 가능 시 토스트 팝업에 가능한 슬롯 목록 + 클릭 시 예약 페이지로 이동하는 버튼 제공### 2.4 사용자 인터페이스

- **페이지 경로**: `/`

- **설정 폼**:

  - 날짜 선택(Date Picker)
  - 시간대 선택(Dropdown)
  - 인원 수 선택(1-10명)
  - 알림 이메일(읽기 전용, 초기 설정 필요)

- **실시간 알림 영역**:

  - 토스트 외에 상단 배너(선택 사항)로 최근 알림 내역 표시

### 2.5 스케줄러/백그라운드

- **방식**:

  - SvelteKit `hooks.server.ts` 또는 별도 Node 스크립트에서 APScheduler/Node-CRON 동작
  - 서버리스 환경에서는 GitHub Actions `workflow_dispatch` + `schedule` 활용 가능

- **종료 조건**:

  - 알림 후 자동 멈춤(한 번만 알림) 또는 사용자 설정에 따라 계속 모니터링

### 2.6 에러 처리 및 로깅

- **스크레이핑 에러**: 재시도 로직(최대 3회), 실패 시 이메일로 관리자 알림
- **API 에러**: 클라이언트에 에러 메시지 전달 및 콘솔 로그 기록
- **전체 로그**: `logs/` 디렉터리에 날짜별 로그 파일 저장

## 3. 비기능 요구사항

- **보안**: 민감 정보(이메일, API 키)는 환경변수로 관리, 깃헙에 커밋 금지
- **확장성**: 다른 레스토랑 추가 모니터링 기능 고려
- **가용성**: 5분 주기 모니터링 시 서비스 중단 최소화
- **성능**: 스크레이핑 한 번당 1초 이내 응답 완료 목표
- **유지보수성**: 코드 모듈화(스크레이퍼, 알림, UI 분리)

## 4. 개발 환경 및 도구

- **프레임워크**: SvelteKit (TypeScript)
- **스크레이핑**: Playwright
- **알림**: @sendgrid/mail, svelte-toast
- **버전 관리**: GitHub 레포 (`remy-ping`)
- **배포**: Vercel 또는 자체 서버
- **CI/CD**: GitHub Actions

## 5. 일정 계획 (MVP)

1. **Day 1**: 프로젝트 스캐폴딩, 환경 변수 설정, Playwright 스크레이퍼 함수 작성
2. **Day 2**: API Route 구현, 이메일 알림 연동
3. **Day 3**: SvelteKit UI 제작, 화면 알림 구현, 통합 테스트 및 배포

## 6. 환경 변수 설정 (.env 파일)

프로젝트 루트에 `.env` 파일을 생성하고 다음 환경 변수를 설정해주세요:

```
# 디즈니랜드 파리 로그인 정보
PRIVATE_DISNEY_EMAIL=your-email@example.com
PRIVATE_DISNEY_PASSWORD=your-password

# Discord 웹훅 설정
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-url

# 스케줄러 설정
ENABLE_SCHEDULER=true
CHECK_INTERVAL_MIN=5
```

모든 환경 변수는 필수입니다. 설정하지 않으면 일부 기능이 작동하지 않을 수 있습니다.

## 7. 설치 및 실행 방법

1. 저장소 클론:

   ```bash
   git clone https://github.com/your-username/remy-ping.git
   cd remy-ping
   ```

2. 의존성 설치:

   ```bash
   npm install
   ```

3. 환경 변수 설정:
   `.env` 파일 생성 및 환경 변수 설정 (위 섹션 참조)

4. 개발 서버 실행:

   ```bash
   npm run dev
   ```

5. 빌드 및 배포:
   ```bash
   npm run build
   npm run preview
   ```

---

이 명세를 바탕으로 RemyPing을 개발하시면, 원하는 날짜와 시간대에 예약 가능 시 이메일과 화면 토스트 알림을 동시에 받을 수 있습니다.
