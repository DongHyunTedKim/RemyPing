import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { checkRemyAvailability } from '$lib/server/scraper';
import { sendDiscordNotification } from '$lib/server/discord';
import { browserInstance, pageInstance } from '../login/start/+server';

/**
 * POST /api/check
 * 특정 날짜와 시간대, 인원 수에 대한 Bistrot Chez Rémy 레스토랑 예약 가능 여부를 확인하는 API
 *
 * Body 파라미터:
 * - date: YYYY-MM-DD 형식의 날짜 문자열
 * - time_slot: 'lunch', 'dinner' 또는 'all'
 * - number_of_guests: 예약할 인원 수 (기본값: 2)
 * - send_notification: 예약 가능 시 알림 전송 여부 (기본값: false)
 */
export async function POST({ request }: RequestEvent) {
	try {
		const { date, timeSlot, guests } = await request.json();

		// 필수 파라미터 확인
		if (!date) {
			return json(
				{
					success: false,
					error: '날짜가 필요합니다.'
				},
				{ status: 400 }
			);
		}

		// 날짜 형식 검증 (YYYY-MM-DD)
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			return json(
				{
					success: false,
					error: '날짜는 YYYY-MM-DD 형식이어야 합니다.'
				},
				{ status: 400 }
			);
		}

		// 브라우저 인스턴스 확인
		if (!browserInstance || !pageInstance) {
			return json(
				{
					success: false,
					error: '로그인 브라우저가 실행되고 있지 않습니다. 로그인 브라우저를 먼저 시작해주세요.'
				},
				{ status: 400 }
			);
		}

		// 로그인 상태 확인
		const result = await checkRemyAvailability(date, timeSlot || 'dinner', Number(guests) || 2);

		return json(result);
	} catch (error) {
		console.error('예약 확인 중 오류:', error);
		return json(
			{
				success: false,
				available: false,
				slots: [],
				error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다'
			},
			{ status: 500 }
		);
	}
}
