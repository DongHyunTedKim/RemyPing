import { json } from '@sveltejs/kit';
import { startLoginBrowser } from '$lib/server/scraper';

// 브라우저 및 페이지 인스턴스를 저장할 전역 변수
// (실제 제품에서는 세션 기반 저장 또는 더 안전한 방법을 사용하는 것이 좋습니다)
let browserInstance: any = null;
let pageInstance: any = null;

/** @type {import('./$types').RequestHandler} */
export async function POST() {
	try {
		// 이미 실행 중인 브라우저가 있다면 종료
		if (browserInstance) {
			try {
				await browserInstance.close();
			} catch (e) {
				console.error('기존 브라우저 종료 중 오류:', e);
			}
		}

		// 새 브라우저 세션 시작
		const { browser, page } = await startLoginBrowser();
		browserInstance = browser;
		pageInstance = page;

		return json({
			success: true,
			message: '로그인 브라우저가 성공적으로 시작되었습니다.'
		});
	} catch (error) {
		console.error('로그인 브라우저 시작 중 오류:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다'
			},
			{ status: 500 }
		);
	}
}

// 현재 브라우저 및 페이지 인스턴스를 내보내어 다른 엔드포인트에서 사용할 수 있게 함
export { browserInstance, pageInstance };
