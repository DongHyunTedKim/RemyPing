import { env } from '$env/dynamic/private';

// Slot 타입 정의 (scraper.ts와 동일)
interface Slot {
	time: string;
	link: string;
}

// Discord 임베드 타입 정의
interface DiscordEmbed {
	title: string;
	description: string;
	color: number;
	fields: Array<{
		name: string;
		value: string;
		inline?: boolean;
	}>;
	footer: {
		text: string;
	};
	timestamp: string;
	url?: string; // url 속성 추가
}

interface DiscordMessage {
	embeds: DiscordEmbed[];
}

/**
 * Discord 웹훅을 통해 레스토랑 예약 가능 알림을 보냅니다.
 *
 * @param date - 예약 날짜 (YYYY-MM-DD)
 * @param timeSlot - 예약 시간대 ('lunch', 'dinner', 등)
 * @param numberOfGuests - 예약 인원 수
 * @param slots - 예약 가능한 시간 슬롯 목록
 * @returns 알림 전송 성공 여부
 */
export async function sendDiscordNotification(
	date: string,
	timeSlot: string,
	numberOfGuests: number,
	slots: Slot[]
): Promise<boolean> {
	const webhookUrl = env.DISCORD_WEBHOOK_URL;

	// 웹훅 URL이 없으면 알림을 보낼 수 없음
	if (!webhookUrl) {
		console.error('Discord webhook URL not found in environment variables');
		return false;
	}

	// 예약 가능한 슬롯이 없으면 알림을 보낼 필요가 없음
	if (slots.length === 0) {
		console.log('No available slots to send notification for');
		return false;
	}

	try {
		// 날짜 형식 변환 (YYYY-MM-DD -> 읽기 좋은 형식)
		const formattedDate = new Date(date).toLocaleDateString('ko-KR', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			weekday: 'long'
		});

		// 시간대 한글 변환
		const timeSlotKorean =
			timeSlot.toLowerCase() === 'lunch'
				? '점심'
				: timeSlot.toLowerCase() === 'dinner'
					? '저녁'
					: timeSlot;

		// Discord 메시지 작성
		const message: DiscordMessage = {
			embeds: [
				{
					title: `🍽️ [RemyPing] 예약 가능: ${formattedDate} ${timeSlotKorean} (${numberOfGuests}명)`,
					description: `Bistrot Chez Rémy 레스토랑에 예약 가능한 시간이 있습니다!`,
					color: 0x00aaff, // 밝은 파란색
					fields: [
						{
							name: '📅 날짜',
							value: formattedDate,
							inline: true
						},
						{
							name: '🕒 시간대',
							value: timeSlotKorean,
							inline: true
						},
						{
							name: '👥 인원',
							value: `${numberOfGuests}명`,
							inline: true
						},
						{
							name: '⏰ 가능한 시간',
							value: slots.map((s) => s.time).join(', ')
						}
					],
					footer: {
						text: 'RemyPing 알림 시스템'
					},
					timestamp: new Date().toISOString()
				}
			]
		};

		// 첫 번째 슬롯의 링크가 있으면 버튼 추가
		if (slots[0]?.link) {
			message.embeds[0].url = slots[0].link;
		}

		// Discord 웹훅 호출
		const response = await fetch(webhookUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(message)
		});

		if (!response.ok) {
			throw new Error(`Discord webhook error: ${response.status} ${response.statusText}`);
		}

		console.log(`Discord notification sent successfully for ${date} ${timeSlot}`);
		return true;
	} catch (error) {
		console.error('Failed to send Discord notification:', error);
		return false;
	}
}
