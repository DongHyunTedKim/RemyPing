import { chromium, type Browser, type Page } from 'playwright';
import { env } from '$env/dynamic/private'; // PRIVATE 환경 변수 접근

interface Slot {
	time: string;
	link: string;
}

interface ScraperResult {
	available: boolean;
	slots: Slot[];
	error?: string; // 에러 메시지 전달을 위한 필드 추가 (선택 사항)
}

// 실제 Bistrot Chez Rémy 예약 페이지 URL로 업데이트
const BISTROT_CHEZ_REMY_URL = 'https://bookrestaurants.disneylandparis.com/en-usd?id=P2TR02';

/**
 * Bistrot Chez Rémy 레스토랑의 예약 가능 여부를 스크레이핑합니다.
 * 주의: 이 함수는 사용자가 이미 로그인한 상태여야 합니다.
 * @param date - YYYY-MM-DD 형식의 날짜 문자열
 * @param timeSlot - 'lunch' 또는 'dinner'와 같은 시간대 문자열
 * @param numberOfGuests - 예약할 인원 수 (기본값: 2)
 * @returns 예약 가능 여부 및 가능한 시간대 목록
 */
export async function checkRemyAvailability(
	date: string,
	timeSlot: 'lunch' | 'dinner' | string,
	numberOfGuests: number = 2
): Promise<ScraperResult> {
	let browser: Browser | null = null;
	let page: Page | null = null; // page 변수를 여기서 선언하고 null로 초기화

	try {
		browser = await chromium.launch({
			headless: false, // 디버깅을 위해 false로 설정
			args: ['--start-maximized'], // 브라우저 창 최대화
			timeout: 30000, // 브라우저 실행 타임아웃 30초로 설정
			ignoreDefaultArgs: ['--enable-automation'] // 자동화 표시 비활성화
		});
		const context = await browser.newContext({
			userAgent:
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
		});
		page = await context.newPage(); // 여기서 page에 할당

		// 페이지 에러 이벤트 리스너 추가
		page.on('pageerror', (error) => {
			console.error('페이지 에러 발생:', error);
		});

		// 콘솔 메시지 캡처
		page.on('console', (msg) => {
			console.log('브라우저 콘솔:', msg.text());
		});

		// 네트워크 에러 캡처
		page.on('requestfailed', (request) => {
			console.error('네트워크 요청 실패:', request.url(), request.failure()?.errorText);
		});

		await page.goto(BISTROT_CHEZ_REMY_URL, {
			waitUntil: 'networkidle', // 모든 네트워크 요청이 완료될 때까지 대기
			timeout: 30000 // 30초 타임아웃
		});
		console.log(`페이지 이동 완료: ${BISTROT_CHEZ_REMY_URL}`);

		// --- 로그인 검증 로직 시작 (자동 로그인 대신) ---
		console.log('로그인 상태 확인 중...');

		// 페이지가 완전히 로드될 때까지 대기
		await page.waitForLoadState('domcontentloaded');
		await page.waitForTimeout(2000); // 추가 2초 대기

		// 로그인 여부를 확인할 수 있는 요소 셀렉터
		const loggedInElementSelector = '[data-testid="choose-my-date"]';

		// 로그인 상태 확인 (타임아웃을 늘림)
		const isLoggedIn = await page
			.waitForSelector(loggedInElementSelector, { timeout: 15000, state: 'visible' })
			.then(() => true)
			.catch(() => false);

		if (!isLoggedIn) {
			console.error(
				'로그인되어 있지 않습니다. 이 함수는 사용자가 이미 로그인한 상태에서 호출해야 합니다.'
			);
			return {
				available: false,
				slots: [],
				error: '로그인되어 있지 않습니다. 먼저 로그인해주세요.'
			};
		}

		console.log('로그인 상태 확인 완료. 스크레이핑을 시작합니다...');
		// --- 로그인 검증 로직 끝 ---

		console.log(`날짜: ${date}, 시간대: ${timeSlot} 에 대한 스크레이핑 시작`);

		// --- 실제 스크레이핑 로직 시작 (로그인 후) ---
		console.log(`Scraping for date: ${date}, time slot: ${timeSlot} (post-login)`);

		// 1. 날짜 선택 로직
		console.log('달력에서 날짜 선택 중...');

		// 날짜 파싱 (YYYY-MM-DD 형식)
		const [year, month, day] = date.split('-').map((part) => parseInt(part, 10));
		console.log(`날짜 파싱 완료: 연도=${year}, 월=${month}, 일=${day}`);

		// 현재 표시된 달력의 월/년 확인 (왼쪽/오른쪽 달력)
		const calendarCaptionSelector = '.style__TypographyBase-sc-9d50454a-0.kouJey'; // 달력 상단의 "May 2025" 같은 캡션
		await page.waitForSelector(calendarCaptionSelector, { timeout: 10000 });

		// 현재 표시된 달력 캡션들 가져오기 (왼쪽/오른쪽 두 달력)
		const calendarCaptions = await page.$$eval(calendarCaptionSelector, (els) =>
			els.map((el) => el.textContent?.trim() || '')
		);
		console.log('달력 캡션 정보:', calendarCaptions);

		// 왼쪽 달력(현재 달)과 오른쪽 달력(다음 달) 구분
		// 일반적으로 첫 번째 캡션이 현재 달, 두 번째 캡션이 다음 달
		const currentMonthCaption = calendarCaptions[0]; // 예: "May 2025"
		const nextMonthCaption = calendarCaptions[1]; // 예: "June 2025"
		console.log('현재 표시된 월:', currentMonthCaption);
		console.log('다음 월:', nextMonthCaption);

		// 달력 캡션에서 월과 년도 추출 (예: "May 2025" -> { month: "May", year: 2025 })
		function parseMonthYear(caption: string) {
			const parts = caption.split(' ');
			if (parts.length === 2) {
				return {
					month: parts[0],
					year: parseInt(parts[1], 10)
				};
			}
			return null;
		}

		const currentMonthData = parseMonthYear(currentMonthCaption);
		const nextMonthData = parseMonthYear(nextMonthCaption);

		console.log('현재 월 파싱 결과:', currentMonthData);
		console.log('다음 월 파싱 결과:', nextMonthData);

		// 원하는 월/년 생성
		const targetDate = new Date(year, month - 1); // 자바스크립트의 월은 0부터 시작 (0=1월)
		const targetMonth = targetDate.toLocaleString('en-US', { month: 'long' }); // 예: "May"
		console.log(`목표 날짜: ${targetMonth} ${year}`);

		// 현재 달력에 표시된 두 달 중 원하는 달이 있는지 확인
		let targetMonthFound = false;
		let targetMonthInRightCalendar = false;

		// 왼쪽 달력(현재 달)에서 확인
		if (
			currentMonthData &&
			currentMonthData.month === targetMonth &&
			currentMonthData.year === year
		) {
			targetMonthFound = true;
			console.log('목표 월을 왼쪽 달력에서 찾았습니다 (현재 월)');
		}
		// 오른쪽 달력(다음 달)에서 확인
		else if (nextMonthData && nextMonthData.month === targetMonth && nextMonthData.year === year) {
			targetMonthFound = true;
			targetMonthInRightCalendar = true;
			console.log('목표 월을 오른쪽 달력에서 찾았습니다 (다음 월)');
		}

		// 원하는 달이 현재 표시된 두 달력에 없고, 현재 달의 다음 달인 경우 네비게이션 시도
		if (!targetMonthFound) {
			console.log('현재 보이는 달력에서 목표 월을 찾을 수 없습니다');

			// 날짜를 비교하여 다음 달로만 이동할 수 있는지 확인
			const currentMonth = new Date();
			currentMonth.setDate(1); // 현재 달의 1일로 설정

			const nextMonth = new Date(currentMonth);
			nextMonth.setMonth(currentMonth.getMonth() + 1); // 현재 달 + 1

			const twoMonthsLater = new Date(currentMonth);
			twoMonthsLater.setMonth(currentMonth.getMonth() + 2); // 현재 달 + 2

			// 타겟 날짜가 다음 달인지 확인 (다음 달로 이동해야 함)
			const canNavigateToTargetMonth = targetDate >= nextMonth && targetDate < twoMonthsLater;

			if (canNavigateToTargetMonth) {
				console.log('목표 월로 이동 가능합니다 (다음 달입니다)');

				// 다음 달 버튼 - 오른쪽 달력 캡션 안의 버튼을 찾아야 함
				// custom-calendar-caption은 페이지에 2개 존재하며, 두 번째 것이 next 버튼
				const nextMonthButtonSelector =
					'.custom-calendar-caption:nth-of-type(2) .custom-calendar-caption__button';

				// 버튼이 존재하는지 확인
				const buttonExists = await page
					.waitForSelector(nextMonthButtonSelector, { timeout: 5000 })
					.then(() => true)
					.catch(() => false);

				if (buttonExists) {
					console.log('다음 달 버튼 클릭 중...');
					await page.click(nextMonthButtonSelector);
					await page.waitForTimeout(500);

					// 달력 캡션 다시 확인
					const updatedCaptions = await page.$$eval(calendarCaptionSelector, (els) =>
						els.map((el) => el.textContent?.trim() || '')
					);

					const updatedCurrentMonthCaption = updatedCaptions[0];
					const updatedNextMonthCaption = updatedCaptions[1];

					console.log('업데이트된 달력 정보:', updatedCaptions);

					// 업데이트된 달력에서 목표 월 확인
					const updatedCurrentMonthData = parseMonthYear(updatedCurrentMonthCaption);
					const updatedNextMonthData = parseMonthYear(updatedNextMonthCaption);

					if (
						(updatedCurrentMonthData &&
							updatedCurrentMonthData.month === targetMonth &&
							updatedCurrentMonthData.year === year) ||
						(updatedNextMonthData &&
							updatedNextMonthData.month === targetMonth &&
							updatedNextMonthData.year === year)
					) {
						targetMonthFound = true;
						console.log('달력 이동 후 목표 월을 찾았습니다');
					}
				} else {
					console.log('다음 달 버튼을 찾을 수 없습니다');
				}
			}
		}

		if (!targetMonthFound) {
			throw new Error(`${targetMonth} ${year} 월로 이동할 수 없습니다`);
		}

		console.log('달력에서 목표 월을 찾았습니다');

		// 2. 날짜(일) 선택
		// 날짜 버튼 찾기 - 클릭 가능한 날짜는 disabled 속성이 없는 버튼임
		const dayButtonSelector = `.rdp-day[role="gridcell"]:not([disabled]) .date`;

		// 먼저 전체 날짜 요소들을 확인 (디버깅 용도)
		const allDayElements = await page.$$eval('.rdp-day[role="gridcell"] .date', (els) =>
			els.map((el) => el.textContent)
		);
		console.log('달력에서 선택 가능한 날짜들:', allDayElements);

		// CSS 셀렉터로 날짜 요소들 찾기
		const dayElements = await page.$$(dayButtonSelector);

		// 원하는 날짜 찾기
		let foundAndClicked = false;
		for (const element of dayElements) {
			const textContent = await element.textContent();
			if (textContent === day.toString()) {
				console.log(`${day}일을 찾았습니다. 클릭합니다...`);
				await element.click();
				foundAndClicked = true;
				break;
			}
		}

		if (!foundAndClicked) {
			throw new Error(`달력에서 ${day}일을 찾을 수 없습니다`);
		}

		console.log('날짜 선택 후 계속 버튼 클릭 중...');
		const dateSelectionContinueSelector = '.confirm-button';
		await page.waitForSelector(dateSelectionContinueSelector, { timeout: 10000 });
		await page.click(dateSelectionContinueSelector);

		console.log('인원 수 선택 중...');
		console.log(`선택할 인원 수: ${numberOfGuests}명`);

		const guestsSelectorContainer = '.radio-as-button-group__wrapper';
		await page.waitForSelector(guestsSelectorContainer, { timeout: 10000 });

		const availableGuestOptions = await page.$$eval('.radio-as-button', (els) =>
			els.map((el) => el.textContent?.trim())
		);
		console.log('선택 가능한 인원 수 옵션:', availableGuestOptions);

		try {
			const guestButton = await page.$$(`.radio-as-button`);
			let buttonFound = false;

			for (const button of guestButton) {
				const buttonText = await button.textContent();
				if (buttonText?.trim() === numberOfGuests.toString()) {
					console.log(`${numberOfGuests}명 버튼 클릭`);
					await button.click();
					buttonFound = true;
					break;
				}
			}

			if (!buttonFound) {
				throw new Error(`${numberOfGuests}명에 대한 버튼을 찾을 수 없습니다`);
			}
		} catch (error) {
			console.error(
				`인원 수 선택 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`
			);
			throw new Error(`${numberOfGuests}명 선택 실패`);
		}

		console.log('인원 선택 후 계속 버튼 클릭 중...');
		const guestSelectionContinueSelector =
			'[role="button"][data-fantasia-ds="Button"]:text-contains("Continue")';

		try {
			await page.waitForSelector(guestSelectionContinueSelector, { timeout: 10000 });
			await page.click(guestSelectionContinueSelector);
			console.log('인원 선택 후 계속 버튼 클릭 완료');
		} catch (error) {
			console.log('대체 계속 버튼 선택자로 시도 중...');
			const alternativeContinueSelector = 'button[role="button"][data-fantasia-ds="Button"]';
			const continueButtons = await page.$$(alternativeContinueSelector);
			let buttonClicked = false;

			for (const button of continueButtons) {
				const buttonText = await button.textContent();
				if (buttonText?.includes('Continue')) {
					await button.click();
					buttonClicked = true;
					break;
				}
			}

			if (!buttonClicked) {
				throw new Error('인원 선택 후 계속 버튼을 찾거나 클릭할 수 없습니다');
			}
		}

		console.log(`시간대 선택: ${timeSlot}`);

		// 시간 선택 UI가 로드될 때까지 대기
		const timeSlotSelector = '.radio-as-button-group__wrapper';
		await page.waitForSelector(timeSlotSelector, { timeout: 15000 });
		console.log('시간 선택 UI 로드 완료');

		// 예약 가능한 시간 슬롯 추출 (disabled 클래스가 없는 버튼들)
		const availableTimeSlots = await page.$$eval('.radio-as-button:not(.disabled)', (els) =>
			els.map((el) => el.textContent?.trim() || '')
		);
		console.log('예약 가능한 시간대:', availableTimeSlots);

		// 시간대에 따라 필터링 (lunch: 11:00-15:00, dinner: 15:00 이후)
		const lunchTimeSlots = availableTimeSlots.filter((time) => {
			const hour = parseInt(time.split(':')[0], 10);
			return hour >= 11 && hour < 15;
		});

		const dinnerTimeSlots = availableTimeSlots.filter((time) => {
			const hour = parseInt(time.split(':')[0], 10);
			return hour >= 15;
		});

		console.log('점심 시간대:', lunchTimeSlots);
		console.log('저녁 시간대:', dinnerTimeSlots);

		// 선택된 시간대에 따라 슬롯 선택
		let targetTimeSlots: string[] = [];
		if (timeSlot.toLowerCase() === 'lunch') {
			targetTimeSlots = lunchTimeSlots;
			console.log('점심 시간대 선택됨');
		} else if (timeSlot.toLowerCase() === 'dinner') {
			targetTimeSlots = dinnerTimeSlots;
			console.log('저녁 시간대 선택됨');
		} else {
			// 특정 시간이 지정되었거나 'all'인 경우 모든 슬롯 사용
			targetTimeSlots = availableTimeSlots;
			console.log('모든 시간대 선택됨');
		}

		if (targetTimeSlots.length === 0) {
			console.log(`선택한 시간대(${timeSlot})에 예약 가능한 슬롯이 없습니다`);
			return {
				available: false,
				slots: []
			};
		}

		// 예약 가능한 슬롯별로 링크 정보 수집
		const availableSlots: Slot[] = [];

		for (const timeString of targetTimeSlots) {
			// 각 시간 슬롯을 클릭하면 예약 페이지로 이동할 수 있는 버튼이 나타날 수 있음
			// 현재는 예시로 가상의 링크를 생성하지만, 실제로는 각 시간 슬롯 클릭 후 나타나는 예약 링크를 추출해야 함
			// (실제 사이트의 동작에 따라 이 부분을 조정할 필요가 있음)
			const reservationLink = `https://bookrestaurants.disneylandparis.com/en-usd?id=P2TR02&date=${date}&time=${timeString}&guests=${numberOfGuests}`;

			availableSlots.push({
				time: timeString,
				link: reservationLink
			});
		}

		console.log(`${timeSlot} 시간대에 ${availableSlots.length}개의 예약 가능한 슬롯을 찾았습니다`);
		const isAvailable = availableSlots.length > 0;

		return {
			available: isAvailable,
			slots: availableSlots
		};
	} catch (error) {
		console.error('스크레이핑 중 오류 발생:', error);
		console.error('스택 트레이스:', error instanceof Error ? error.stack : '스택 정보 없음');
		// 스크레이핑 전체 프로세스에서 오류 발생 시 스크린샷 (페이지 객체가 유효할 경우)
		if (page && !page.isClosed()) {
			// page가 null이 아니고 닫히지 않았는지 확인
			const screenshotPath = 'screenshots/scraping_error_screenshot.png';
			try {
				await page.screenshot({ path: screenshotPath, fullPage: true });
				console.log(`스크레이핑 오류 발생 시 스크린샷 저장 완료: ${screenshotPath}`);
			} catch (screenshotError) {
				console.error('스크린샷 저장 중 오류 발생:', screenshotError);
			}
		}

		return {
			available: false,
			slots: [],
			error: error instanceof Error ? error.message : String(error)
		};
	} finally {
		// 브라우저를 자동으로 종료하지 않음
		console.log('오류가 발생한 경우 브라우저를 수동으로 종료해주세요.');
		// if (browser) {
		// 	 await browser.close();
		// }
	}
}

/**
 * 브라우저를 시작하고 디즈니 레스토랑 예약 페이지로 이동합니다.
 * 사용자가 직접 로그인할 수 있도록 브라우저 창을 엽니다.
 * @returns Browser 및 Page 객체
 */
export async function startLoginBrowser(): Promise<{ browser: Browser; page: Page }> {
	const browser = await chromium.launch({
		headless: false,
		args: ['--start-maximized'],
		timeout: 30000,
		ignoreDefaultArgs: ['--enable-automation']
	});
	const context = await browser.newContext({
		userAgent:
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
	});
	const page = await context.newPage();

	page.on('pageerror', (error) => {
		console.error('페이지 에러 발생:', error);
	});

	page.on('console', (msg) => {
		console.log('브라우저 콘솔:', msg.text());
	});

	await page.goto(BISTROT_CHEZ_REMY_URL, {
		waitUntil: 'networkidle',
		timeout: 30000
	});
	console.log(`로그인을 위한 브라우저 시작됨: ${BISTROT_CHEZ_REMY_URL}`);

	return { browser, page };
}

/**
 * 사용자가 로그인 완료 버튼을 클릭한 후 로그인 상태를 확인합니다.
 * @param page 로그인을 확인할 Page 객체
 * @returns 로그인 상태 (성공 여부)
 */
export async function verifyLogin(page: Page): Promise<boolean> {
	// 페이지가 완전히 로드될 때까지 대기
	await page.waitForLoadState('domcontentloaded');
	await page.waitForTimeout(2000);

	// 로그인 여부를 확인할 수 있는 요소 셀렉터
	const loggedInElementSelector = '[data-testid="choose-my-date"]';

	// 로그인 상태 확인
	const isLoggedIn = await page
		.waitForSelector(loggedInElementSelector, { timeout: 15000, state: 'visible' })
		.then(() => true)
		.catch(() => false);

	if (isLoggedIn) {
		console.log('로그인 확인 완료: 로그인되어 있습니다.');
		return true;
	} else {
		console.log('로그인 확인 완료: 로그인되어 있지 않습니다.');
		return false;
	}
}
