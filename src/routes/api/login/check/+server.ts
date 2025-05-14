import { json } from '@sveltejs/kit';
import { verifyLogin } from '$lib/server/scraper';
import { browserInstance, pageInstance } from '../start/+server';

/** @type {import('./$types').RequestHandler} */
export async function GET() {
	try {
		// 브라우저 인스턴스가 없는 경우
		if (!browserInstance || !pageInstance) {
			return json({
				loggedIn: false,
				error: '로그인 브라우저가 실행되고 있지 않습니다.'
			});
		}

		// 로그인 상태 확인
		const isLoggedIn = await verifyLogin(pageInstance);

		return json({
			loggedIn: isLoggedIn
		});
	} catch (error) {
		console.error('로그인 상태 확인 중 오류:', error);
		return json(
			{
				loggedIn: false,
				error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다'
			},
			{ status: 500 }
		);
	}
}
