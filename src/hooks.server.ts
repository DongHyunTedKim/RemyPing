import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { checkRemyAvailability } from '$lib/server/scraper';
import { sendDiscordNotification } from '$lib/server/discord';

// 스케줄 된 작업 정보 인터페이스
interface ScheduledJob {
	id: string;
	date: string;
	timeSlot: string;
	numberOfGuests: number;
	interval: number; // 분 단위
	lastChecked: Date;
	enabled: boolean;
	notificationSent: boolean;
}

// 활성화된 작업 목록 (서버 메모리에 저장)
const activeJobs: ScheduledJob[] = [];

// 환경 변수에서 작업 간격 가져오기 (기본값: 5분)
const CHECK_INTERVAL_MIN = parseInt(env.CHECK_INTERVAL_MIN || '5', 10);

// 작업 관리 함수
function addJob(date: string, timeSlot: string, numberOfGuests: number = 2): string {
	const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

	activeJobs.push({
		id: jobId,
		date,
		timeSlot,
		numberOfGuests,
		interval: CHECK_INTERVAL_MIN,
		lastChecked: new Date(0), // 1970-01-01, 즉시 첫 체크가 실행되도록
		enabled: true,
		notificationSent: false
	});

	console.log(
		`스케줄러: 작업 추가됨 - 날짜: ${date}, 시간대: ${timeSlot}, 인원: ${numberOfGuests}명, 간격: ${CHECK_INTERVAL_MIN}분`
	);
	return jobId;
}

function removeJob(jobId: string): boolean {
	const initialLength = activeJobs.length;
	const index = activeJobs.findIndex((job) => job.id === jobId);

	if (index !== -1) {
		activeJobs.splice(index, 1);
		console.log(`스케줄러: 작업 제거됨 - ID: ${jobId}`);
		return true;
	}

	return false;
}

// 모든 작업 실행 함수
async function runAllJobs() {
	console.log(`스케줄러: ${activeJobs.length}개 작업 확인 중...`);

	for (const job of activeJobs) {
		// 해당 작업이 실행 가능한지 확인 (간격 체크)
		const now = new Date();
		const minutesSinceLastCheck = (now.getTime() - job.lastChecked.getTime()) / (1000 * 60);

		// 아직 실행 간격이 지나지 않았거나, 이미 알림이 발송되었으면 건너뜀
		if (minutesSinceLastCheck < job.interval || job.notificationSent) {
			continue;
		}

		console.log(`스케줄러: 작업 실행 - ID: ${job.id}, 날짜: ${job.date}, 시간대: ${job.timeSlot}`);
		job.lastChecked = now;

		try {
			// 예약 가능 여부 확인
			const result = await checkRemyAvailability(job.date, job.timeSlot, job.numberOfGuests);

			// 예약 가능하면 Discord 알림 발송
			if (result.available && result.slots.length > 0) {
				console.log(
					`스케줄러: 예약 가능! - 날짜: ${job.date}, 시간대: ${job.timeSlot}, 슬롯: ${result.slots.length}개`
				);

				// Discord 알림 발송
				const notificationSent = await sendDiscordNotification(
					job.date,
					job.timeSlot,
					job.numberOfGuests,
					result.slots
				);

				if (notificationSent) {
					job.notificationSent = true;
					console.log(`스케줄러: 알림 전송 성공 - ID: ${job.id}`);
				}
			} else {
				console.log(
					`스케줄러: 예약 불가 - ID: ${job.id}, 오류: ${result.error || '예약 슬롯 없음'}`
				);
			}
		} catch (error) {
			console.error(`스케줄러: 작업 실행 중 오류 발생 - ID: ${job.id}`, error);
		}
	}
}

// 서버 시작 시 스케줄러 초기화
let schedulerInterval: ReturnType<typeof setInterval> | null = null;

// 스케줄러 시작 함수
function startScheduler() {
	if (schedulerInterval) {
		return;
	}

	// 스케줄러 간격 설정 (분 -> 밀리초)
	const intervalMs = Math.max(1, CHECK_INTERVAL_MIN) * 60 * 1000;

	schedulerInterval = setInterval(() => {
		runAllJobs().catch((error) => {
			console.error('스케줄러 실행 중 오류:', error);
		});
	}, intervalMs);

	console.log(`스케줄러: 시작됨 (간격: ${CHECK_INTERVAL_MIN}분)`);

	// 즉시 첫 실행
	runAllJobs().catch((error) => {
		console.error('스케줄러 첫 실행 중 오류:', error);
	});
}

// 스케줄러 중지 함수
function stopScheduler() {
	if (schedulerInterval) {
		clearInterval(schedulerInterval);
		schedulerInterval = null;
		console.log('스케줄러: 중지됨');
	}
}

// 서버 시작 시 스케줄러 시작
if (env.ENABLE_SCHEDULER === 'true') {
	startScheduler();

	// 테스트용 예시 작업 추가 (실제 사용 시 제거 또는 주석 처리)
	// const tomorrow = new Date();
	// tomorrow.setDate(tomorrow.getDate() + 1);
	// const tomorrowString = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD
	// addJob(tomorrowString, 'dinner', 2);
}

// SvelteKit 핸들러
export const handle: Handle = async ({ event, resolve }) => {
	// 스케줄러 API 엔드포인트 (보안 고려 필요)
	const { pathname } = event.url;

	// 스케줄러 API 경로 처리 (추후 보안 고려 필요)
	if (pathname.startsWith('/api/scheduler/')) {
		const action = pathname.split('/').pop();

		if (action === 'jobs' && event.request.method === 'GET') {
			return new Response(JSON.stringify({ jobs: activeJobs }), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		if (action === 'add' && event.request.method === 'POST') {
			try {
				const data = await event.request.json();
				const { date, timeSlot, numberOfGuests } = data;

				if (!date || !timeSlot) {
					return new Response(JSON.stringify({ error: '날짜와 시간대는 필수 입력값입니다.' }), {
						status: 400,
						headers: { 'Content-Type': 'application/json' }
					});
				}

				const jobId = addJob(date, timeSlot, numberOfGuests || 2);
				return new Response(JSON.stringify({ success: true, jobId }), {
					headers: { 'Content-Type': 'application/json' }
				});
			} catch (error) {
				return new Response(JSON.stringify({ error: '요청 처리 중 오류가 발생했습니다.' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' }
				});
			}
		}

		if (action === 'remove' && event.request.method === 'POST') {
			try {
				const data = await event.request.json();
				const { jobId } = data;

				if (!jobId) {
					return new Response(JSON.stringify({ error: '작업 ID는 필수 입력값입니다.' }), {
						status: 400,
						headers: { 'Content-Type': 'application/json' }
					});
				}

				const removed = removeJob(jobId);
				return new Response(JSON.stringify({ success: removed }), {
					headers: { 'Content-Type': 'application/json' }
				});
			} catch (error) {
				return new Response(JSON.stringify({ error: '요청 처리 중 오류가 발생했습니다.' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' }
				});
			}
		}
	}

	// 일반 SvelteKit 요청 처리
	return await resolve(event);
};
