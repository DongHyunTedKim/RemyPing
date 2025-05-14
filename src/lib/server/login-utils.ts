// 로그인 자동화 관련 코드 (현재 사용하지 않음)
// 자동화 탐지로 인한 문제로 인해 주석 처리되었습니다.
// 필요시 활성화하여 사용할 수 있습니다.

import { chromium, type Browser, type Page } from 'playwright';
import { env } from '$env/dynamic/private'; // PRIVATE 환경 변수 접근

/**
 * 디즈니 사이트 로그인 시도
 * 자동화 탐지 및 2FA 문제로 현재 사용하지 않음
 * @param page Playwright Page 객체
 * @returns 로그인 성공 여부
 */
export async function attemptDisneyLogin(page: Page): Promise<boolean> {
	try {
		const email = env.PRIVATE_DISNEY_EMAIL;
		const password = env.PRIVATE_DISNEY_PASSWORD;

		if (!email || !password) {
			console.error('오류: 디즈니 로그인 정보를 환경 변수에서 찾을 수 없습니다.');
			return false;
		}

		// 로그인 상태 확인 로직
		console.log('로그인 상태 확인 중...');

		// 페이지가 완전히 로드될 때까지 대기
		await page.waitForLoadState('domcontentloaded');
		await page.waitForTimeout(2000); // 추가 2초 대기

		// 로그인 여부를 확인할 수 있는 요소 셀렉터
		const loggedInElementSelector = '[data-testid="choose-my-date"]';

		// 로그인 상태 확인
		const isLoggedIn = await page
			.waitForSelector(loggedInElementSelector, { timeout: 15000, state: 'visible' })
			.then(() => true)
			.catch(() => false);

		if (isLoggedIn) {
			console.log('이미 로그인되어 있습니다. 로그인 과정을 건너뜁니다.');

			const rejectCookiesButtonSelector = '#footer_tc_privacy_button_2';
			const hasCookiePopup = await page
				.waitForSelector(rejectCookiesButtonSelector, { timeout: 5000, state: 'visible' })
				.then(() => true)
				.catch(() => false);

			if (hasCookiePopup) {
				await page.click(rejectCookiesButtonSelector);
				console.log('쿠키 정책 거부 완료.');
			}

			return true;
		} else {
			console.log('로그인되어 있지 않습니다. 로그인을 시작합니다...');
			console.log('다단계 로그인 시도 중...');

			// 로그인 페이지가 완전히 로드될 때까지 대기
			await page.waitForLoadState('domcontentloaded');
			await page.waitForTimeout(2000);

			// 먼저 로그인 폼을 포함하는 iframe 확인
			console.log('로그인 iframe 확인 중...');
			const iframeSelector = '#oneid-iframe';

			await page.waitForSelector(iframeSelector, {
				timeout: 15000,
				state: 'attached' // 'visible'에서 'attached'로 변경 - hidden 상태여도 진행
			});
			console.log('로그인 iframe을 찾았습니다');

			// iframe 정보 로깅 (디버깅용)
			const iframeInfo = await page.$eval(iframeSelector, (iframe) => ({
				id: (iframe as HTMLIFrameElement).id,
				src: (iframe as HTMLIFrameElement).src,
				hidden: (iframe as HTMLIFrameElement).hidden,
				style: (iframe as HTMLIFrameElement).getAttribute('style'),
				classes: (iframe as HTMLIFrameElement).className
			}));
			console.log('iframe 정보:', iframeInfo.id);

			// iframe 내부 요소에 접근하기 위한 frameLocator 생성
			const frame = page.frameLocator(iframeSelector);

			// 2. data-testid 속성을 가진 모든 요소 찾기
			const dataTestIdElements = await page
				.frame({
					name: await page.$eval(
						iframeSelector,
						(iframe) => (iframe as HTMLIFrameElement).name || (iframe as HTMLIFrameElement).src
					)
				})
				?.evaluate(() => {
					const elements = document.querySelectorAll('[data-testid]');
					return Array.from(elements).map((el) => ({
						tagName: el.tagName,
						dataTestId: el.getAttribute('data-testid'),
						className: el.className,
						id: el.id,
						type: el.getAttribute('type')
					}));
				});
			console.log('data-testid 속성을 가진 요소들:', dataTestIdElements);

			// iframe 내부에서 이메일 입력 컨테이너 찾기
			console.log('iframe 내부에서 이메일 입력 컨테이너 찾는 중...');
			const containerSelector = '[data-testid="InputIdentityFlowValue-container"]';
			await frame.locator(containerSelector).waitFor({
				timeout: 20000,
				state: 'attached' // 'visible'에서 'attached'로 변경
			});
			console.log('이메일 입력 컨테이너를 iframe 내에서 찾았습니다');

			// iframe 내부에서 이메일 입력 필드 찾기
			console.log('iframe 내부에서 이메일 입력 필드 찾는 중...');
			await frame.locator(`${containerSelector} input[type="email"]`).waitFor({
				timeout: 10000,
				state: 'attached' // 'visible'에서 'attached'로 변경
			});
			console.log('이메일 입력 필드를 iframe 내에서 찾았습니다');

			// 이메일 입력
			await frame.locator(`${containerSelector} input[type="email"]`).fill(email);
			console.log('이메일 입력 완료.');

			// 입력된 값 확인
			const inputValue = await frame
				.locator(`${containerSelector} input[type="email"]`)
				.inputValue();
			if (!inputValue) {
				console.log('이메일이 제대로 입력되지 않았습니다. 다시 시도합니다...');
				await frame.locator(`${containerSelector} input[type="email"]`).click();
				await page.keyboard.type(email); // 키보드 이벤트는 page에서 전송
			}

			// iframe 내부에서 계속 버튼 찾기 및 클릭
			const continueButtonSelector = '#BtnSubmit';
			await frame.locator(continueButtonSelector).waitFor({
				timeout: 10000,
				state: 'attached' // 'visible'에서 'attached'로 변경
			});
			await frame.locator(continueButtonSelector).click();
			console.log('계속 버튼 클릭 완료.');

			// 비밀번호 입력 - iframe이 변경되었을 수 있으므로 다시 확인
			console.log('비밀번호 입력 필드 찾는 중...');
			const passwordInputSelector = '#InputPassword';
			await frame.locator(passwordInputSelector).waitFor({
				timeout: 15000,
				state: 'attached' // 'visible'에서 'attached'로 변경
			});
			await frame.locator(passwordInputSelector).fill(password);
			console.log('비밀번호 입력 완료.');

			// 로그인 버튼 클릭
			const loginButtonSelector = '#BtnSubmit';
			await frame.locator(loginButtonSelector).click();
			console.log('로그인 버튼 클릭 완료.');

			// 3. 쿠키 정책 처리 (메인 페이지에서 처리)
			const rejectCookiesButtonSelector = '#footer_tc_privacy_button_2';
			const hasCookiePopup = await page
				.waitForSelector(rejectCookiesButtonSelector, {
					timeout: 5000,
					state: 'visible'
				})
				.then(() => true)
				.catch(() => false);

			if (hasCookiePopup) {
				await page.click(rejectCookiesButtonSelector);
				console.log('쿠키 정책 거부 완료.');
			} else {
				console.log('쿠키 정책 팝업이 없습니다. 계속 진행합니다...');
			}

			// 4. 로그인 완료 확인 (메인 페이지에서 확인)
			await page.waitForSelector(loggedInElementSelector, {
				timeout: 20000,
				state: 'visible'
			});
			console.log('로그인 완료 확인됨');

			return true;
		}
	} catch (error) {
		console.error('로그인 프로세스 중 오류 발생:', error);
		// 오류 발생 시 스크린샷 저장
		const screenshotPath = 'screenshots/error_screenshot.png';
		try {
			await page.screenshot({ path: screenshotPath, fullPage: true });
			console.log(`오류 발생 시 스크린샷 저장 완료: ${screenshotPath}`);
		} catch (screenshotError) {
			console.error('스크린샷 저장 중 오류 발생:', screenshotError);
		}
		return false;
	}
}
