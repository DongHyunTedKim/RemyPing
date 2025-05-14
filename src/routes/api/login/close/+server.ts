import { json } from '@sveltejs/kit';
import { browserInstance, pageInstance } from '../start/+server';

/** @type {import('./$types').RequestHandler} */
export async function POST() {
	try {
		if (browserInstance) {
			await browserInstance.close();
			console.log('브라우저가 성공적으로 종료되었습니다.');
		}

		// 인스턴스 초기화
		browserInstance = null;
		pageInstance = null;

		return json({
			success: true,
			message: '브라우저가 성공적으로 종료되었습니다.'
		});
	} catch (error) {
		console.error('브라우저 종료 중 오류:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다'
			},
			{ status: 500 }
		);
	}
}
