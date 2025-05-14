<script lang="ts">
	import { onMount } from 'svelte';
	import ManualLoginProcess from '../components/ManualLoginProcess.svelte';

	// 입력 필드 상태
	let date = '';
	let timeSlot = 'dinner';
	let numberOfGuests = 2;
	let enableNotification = true;

	// 검색 결과와 로딩 상태
	let isLoading = false;
	let result: any = null;
	let errorMessage = '';

	// 날짜 입력 필드 제약 조건
	let minDate = '';
	let maxDate = '';

	// 오늘 날짜를 YYYY-MM-DD 형식으로 가져오기
	const today = new Date();
	const formattedDate = today.toISOString().split('T')[0];

	onMount(() => {
		// 현재 날짜를 기본값으로 설정
		const formattedToday = formatDate(today);
		date = formattedToday;

		// 최소 날짜는 오늘
		minDate = formattedToday;

		// 최대 날짜는 6개월 후
		const sixMonthsLater = new Date();
		sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
		maxDate = formatDate(sixMonthsLater);
	});

	// 날짜 형식 변환 유틸리티 함수 (Date -> YYYY-MM-DD)
	function formatDate(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	// 예약 가능 여부 확인 함수
	async function checkAvailability() {
		// 유효성 검사
		if (!date) {
			errorMessage = '날짜를 선택해주세요.';
			return;
		}

		// 로딩 상태 시작
		isLoading = true;
		errorMessage = '';
		result = null;

		try {
			// API 호출
			const response = await fetch('/api/check', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					date,
					time_slot: timeSlot,
					number_of_guests: numberOfGuests,
					send_notification: enableNotification
				})
			});

			// JSON 응답 파싱
			const data = await response.json();

			// 오류 처리
			if (!response.ok) {
				errorMessage = data.error || '요청 처리 중 오류가 발생했습니다.';
				return;
			}

			// 결과 저장
			result = data;
			console.log('조회 결과:', result);
		} catch (error) {
			console.error('API 요청 오류:', error);
			errorMessage = '서버 연결 중 오류가 발생했습니다.';
		} finally {
			// 로딩 상태 종료
			isLoading = false;
		}
	}

	// 스케줄러에 작업 추가 함수
	async function addToScheduler() {
		if (!date) {
			errorMessage = '날짜를 선택해주세요.';
			return;
		}

		isLoading = true;
		errorMessage = '';

		try {
			const response = await fetch('/api/scheduler/add', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					date,
					timeSlot,
					numberOfGuests
				})
			});

			const data = await response.json();

			if (!response.ok) {
				errorMessage = data.error || '스케줄러 작업 추가 중 오류가 발생했습니다.';
				return;
			}

			alert(`작업이 스케줄러에 추가되었습니다! (ID: ${data.jobId})`);
		} catch (error) {
			console.error('스케줄러 API 요청 오류:', error);
			errorMessage = '서버 연결 중 오류가 발생했습니다.';
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>레미 레스토랑 예약 확인</title>
	<link
		rel="stylesheet"
		as="style"
		crossorigin="anonymous"
		href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
	/>
</svelte:head>

<main class="flex min-h-screen items-center justify-center bg-white px-4 py-8 font-['Pretendard']">
	<div class="mx-auto w-full max-w-[500px] min-w-[300px]">
		<!-- 헤더 섹션 -->
		<header class="mb-10 text-center">
			<h1 class="mb-2 text-3xl font-bold tracking-tight text-black">RemyPing</h1>
			<p class="mx-auto max-w-md text-gray-600">
				디즈니랜드 파리 <span class="font-medium text-black">"Bistrot Chez Rémy"</span> 레스토랑의 예약
				가능 여부를 확인합니다.
			</p>
			<a
				href="https://bookrestaurants.disneylandparis.com/en-usd?id=P2TR02"
				target="_blank"
				rel="noopener noreferrer"
				class="mt-4 text-sm text-gray-600 underline hover:text-black"
			>
				Book a Table | Disneyland Paris Bistrot Chez Rémy
			</a>
		</header>

		<!-- 폼 섹션 -->
		<div class="card mb-8 p-6 md:p-8">
			<form on:submit|preventDefault={checkAvailability} class="space-y-6">
				<!-- 날짜 선택 -->
				<div>
					<label for="date" class="mb-2 block text-sm font-medium text-black"> 방문 날짜 </label>
					<input
						type="date"
						id="date"
						bind:value={date}
						min={minDate}
						max={maxDate}
						class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
					/>
				</div>

				<!-- 시간대 선택 -->
				<div>
					<label for="timeSlot" class="mb-2 block text-sm font-medium text-black">
						식사 시간
					</label>
					<select
						id="timeSlot"
						bind:value={timeSlot}
						class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
					>
						<option value="lunch">점심 (11:00-15:00)</option>
						<option value="dinner">저녁 (15:00 이후)</option>
						<option value="all">전체 시간</option>
					</select>
				</div>

				<!-- 인원 수 선택 -->
				<div>
					<div class="mb-2 flex justify-between">
						<label for="guest-count" class="block text-sm font-medium text-black"> 인원 수 </label>
						<span id="guest-count" class="text-sm font-medium text-black">{numberOfGuests}명</span>
					</div>
					<div class="mb-1 grid grid-cols-5 gap-2">
						{#each Array.from({ length: 5 }, (_, i) => i + 1) as num}
							<button
								type="button"
								class="h-10 rounded-lg text-sm font-medium transition-colors {numberOfGuests === num
									? 'bg-black text-white'
									: 'bg-gray-100 text-black hover:bg-gray-200'}"
								on:click={() => (numberOfGuests = num)}
								aria-label="{num}명 선택"
							>
								{num}
							</button>
						{/each}
					</div>
					<div class="grid grid-cols-5 gap-2">
						{#each Array.from({ length: 5 }, (_, i) => i + 6) as num}
							<button
								type="button"
								class="h-10 rounded-lg text-sm font-medium transition-colors {numberOfGuests === num
									? 'bg-black text-white'
									: 'bg-gray-100 text-black hover:bg-gray-200'}"
								on:click={() => (numberOfGuests = num)}
								aria-label="{num}명 선택"
							>
								{num}
							</button>
						{/each}
					</div>
				</div>

				<!-- 알림 설정 -->
				<div class="flex items-center justify-between py-2">
					<span class="text-sm font-medium text-black">Discord 알림 받기</span>
					<label class="relative inline-flex cursor-pointer items-center">
						<input type="checkbox" bind:checked={enableNotification} class="peer sr-only" />
						<div
							class="h-6 w-11 rounded-full bg-gray-200 peer-checked:bg-blue-600 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"
						></div>
					</label>
				</div>

				<!-- 버튼 영역 -->
				<div class="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
					<button
						type="submit"
						class="mx-auto flex h-10 max-w-[200px] min-w-[150px] items-center justify-center rounded-lg bg-black px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
						disabled={isLoading}
					>
						{#if isLoading}
							<span>조회 중...</span>
						{:else}
							<span>예약 가능 여부 확인</span>
						{/if}
					</button>
					<button
						type="button"
						on:click={addToScheduler}
						class="mx-auto flex h-10 max-w-[200px] min-w-[150px] items-center justify-center rounded-lg border border-black bg-white px-4 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-50 disabled:opacity-50"
						disabled={isLoading}
					>
						<span>모니터링 추가</span>
					</button>
				</div>

				<!-- 오류 메시지 -->
				{#if errorMessage}
					<div class="flex w-full items-start rounded-lg bg-red-50 p-4 text-red-700" role="alert">
						<span>{errorMessage}</span>
					</div>
				{/if}
			</form>
		</div>

		<!-- 결과 표시 영역 -->
		{#if result}
			<div class="rounded-lg bg-white p-6 shadow-lg md:p-8">
				<h2 class="mb-4 text-xl font-semibold text-black">조회 결과</h2>

				{#if result.available}
					<div class="mb-6 flex w-full items-start rounded-lg bg-green-50 p-4 text-green-700">
						<div>
							<p class="font-medium">예약 가능합니다!</p>
							<p class="mt-1 text-sm">
								{result.date} ({result.time_slot === 'lunch'
									? '점심'
									: result.time_slot === 'dinner'
										? '저녁'
										: '전체'}) - {result.number_of_guests}명
							</p>
						</div>
					</div>

					<div>
						<h3 class="mb-3 text-sm font-medium text-black">예약 가능한 시간:</h3>
						<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
							{#each result.slots as slot}
								<a
									href={slot.link}
									target="_blank"
									rel="noopener noreferrer"
									class="rounded-lg bg-gray-100 px-4 py-3 text-center font-medium text-black transition-colors hover:bg-gray-200"
								>
									{slot.time}
								</a>
							{/each}
						</div>
					</div>

					{#if result.notification_sent}
						<div class="mt-5 flex items-center text-sm text-gray-600">
							<span>Discord 알림이 성공적으로 전송되었습니다.</span>
						</div>
					{/if}
				{:else}
					<div class="mb-6 flex w-full items-start rounded-lg bg-yellow-50 p-4 text-yellow-700">
						<div>
							<p class="font-medium">예약 불가능합니다.</p>
							<p class="mt-1 text-sm">
								{result.date} ({result.time_slot === 'lunch'
									? '점심'
									: result.time_slot === 'dinner'
										? '저녁'
										: '전체'}) - {result.number_of_guests}명
							</p>
							<p class="mt-2 text-sm">
								현재 시간대에 예약 가능한 슬롯이 없습니다. 나중에 다시 확인해보세요.
							</p>
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- 푸터 -->
		<footer class="mt-12 text-center text-sm text-gray-500">
			<p>RemyPing © {new Date().getFullYear()}</p>
		</footer>
	</div>

	<div class="container">
		<ManualLoginProcess date={formattedDate} />
	</div>
</main>

<style>
	main {
		padding: 2rem;
		margin: 0 auto;
		max-width: 800px;
	}

	h1 {
		text-align: center;
		margin-bottom: 2rem;
		color: #2c3e50;
	}

	.container {
		background-color: white;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		overflow: hidden;
	}
</style>
