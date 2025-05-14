<!--
  수동 로그인 프로세스를 처리하는 컴포넌트
  1. 사용자가 로그인 브라우저를 실행
  2. 수동으로 로그인 완료
  3. 로그인 확인 후 예약 스크래핑 시작
-->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Browser, Page } from 'playwright';

	export let date: string;
	export let timeSlot: string = 'dinner';
	export let guests: number = 2;

	let loading = false;
	let loginStatus:
		| 'idle'
		| 'browser_opened'
		| 'login_verified'
		| 'scraping'
		| 'completed'
		| 'error' = 'idle';
	let errorMessage = '';
	let browser: Browser | null = null;
	let page: Page | null = null;
	let results: any = null;

	// 브라우저 상태 추적을 위한 시간 간격 ID
	let statusCheckIntervalId: number | null = null;

	// 컴포넌트 제거 시 정리
	onDestroy(() => {
		if (statusCheckIntervalId) {
			clearInterval(statusCheckIntervalId);
		}
		closeBrowser();
	});

	// 로그인 브라우저 열기
	async function openLoginBrowser() {
		loading = true;
		loginStatus = 'browser_opened';
		errorMessage = '';

		try {
			const response = await fetch('/api/login/start', {
				method: 'POST'
			});

			if (!response.ok) {
				throw new Error('브라우저를 시작하는 데 실패했습니다');
			}

			const result = await response.json();
			if (result.success) {
				// 5초마다 로그인 상태 확인
				statusCheckIntervalId = setInterval(checkLoginStatus, 5000) as unknown as number;
			} else {
				throw new Error(result.error || '알 수 없는 오류가 발생했습니다');
			}
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
			loginStatus = 'error';
		} finally {
			loading = false;
		}
	}

	// 로그인 상태 확인
	async function checkLoginStatus() {
		try {
			const response = await fetch('/api/login/check', {
				method: 'GET'
			});

			if (!response.ok) {
				throw new Error('로그인 상태를 확인하는 데 실패했습니다');
			}

			const result = await response.json();
			if (result.loggedIn) {
				if (loginStatus !== 'login_verified') {
					loginStatus = 'login_verified';
					if (statusCheckIntervalId) {
						clearInterval(statusCheckIntervalId);
						statusCheckIntervalId = null;
					}
				}
			}
		} catch (error) {
			console.error('로그인 상태 확인 중 오류:', error);
		}
	}

	// 스크래핑 시작
	async function startScraping() {
		loading = true;
		loginStatus = 'scraping';
		errorMessage = '';

		try {
			const response = await fetch('/api/check', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					date,
					timeSlot,
					guests
				})
			});

			if (!response.ok) {
				throw new Error('스크래핑을 시작하는 데 실패했습니다');
			}

			results = await response.json();
			loginStatus = 'completed';
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
			loginStatus = 'error';
		} finally {
			loading = false;
		}
	}

	// 브라우저 닫기
	async function closeBrowser() {
		if (loginStatus === 'browser_opened' || loginStatus === 'login_verified') {
			try {
				await fetch('/api/login/close', {
					method: 'POST'
				});
			} catch (error) {
				console.error('브라우저 닫기 실패:', error);
			}
		}
	}

	// 프로세스 재시작
	function resetProcess() {
		loginStatus = 'idle';
		errorMessage = '';
		results = null;
		if (statusCheckIntervalId) {
			clearInterval(statusCheckIntervalId);
			statusCheckIntervalId = null;
		}
		closeBrowser();
	}
</script>

<div class="manual-login-container">
	<h2>디즈니 레스토랑 예약 확인</h2>

	{#if loginStatus === 'idle'}
		<div class="info-box">
			<p>이 도구는 디즈니랜드 파리의 Bistrot Chez Rémy 레스토랑 예약 가능 여부를 확인합니다.</p>
			<p>
				<strong>참고:</strong> 자동 로그인이 더 이상 작동하지 않아 수동 로그인이 필요합니다.
			</p>
		</div>

		<div class="button-container">
			<button on:click={openLoginBrowser} disabled={loading}>
				{loading ? '처리 중...' : '로그인 브라우저 열기'}
			</button>
		</div>
	{:else if loginStatus === 'browser_opened'}
		<div class="info-box">
			<h3>로그인 진행 중...</h3>
			<p>1. 열린 브라우저 창에서 디즈니 계정으로 로그인해 주세요.</p>
			<p>2. 로그인이 완료되면 자동으로 다음 단계로 진행됩니다.</p>
			<p>
				<em>참고: 이 과정은 몇 초가 소요될 수 있습니다.</em>
			</p>
		</div>

		<div class="loading-indicator">
			로그인 확인 중... <span class="spinner"></span>
		</div>

		<div class="button-container">
			<button on:click={resetProcess} class="secondary-button"> 취소하고 처음으로 돌아가기 </button>
		</div>
	{:else if loginStatus === 'login_verified'}
		<div class="info-box success">
			<h3>로그인 성공!</h3>
			<p>디즈니 계정에 성공적으로 로그인했습니다. 이제 예약 가능 여부를 확인할 수 있습니다.</p>
		</div>

		<div class="form-container">
			<div class="form-group">
				<label for="date">날짜 (YYYY-MM-DD)</label>
				<input type="date" id="date" bind:value={date} />
			</div>

			<div class="form-group">
				<label for="timeSlot">시간대</label>
				<select id="timeSlot" bind:value={timeSlot}>
					<option value="lunch">점심 (11:00 - 15:00)</option>
					<option value="dinner">저녁 (15:00 이후)</option>
					<option value="all">전체 시간대</option>
				</select>
			</div>

			<div class="form-group">
				<label for="guests">인원 수</label>
				<input type="number" id="guests" bind:value={guests} min="1" max="10" />
			</div>
		</div>

		<div class="button-container">
			<button on:click={startScraping} disabled={loading}>
				{loading ? '처리 중...' : '예약 가능 여부 확인하기'}
			</button>
			<button on:click={resetProcess} class="secondary-button"> 처음으로 돌아가기 </button>
		</div>
	{:else if loginStatus === 'scraping'}
		<div class="info-box">
			<h3>예약 가능 여부 확인 중...</h3>
			<p>
				선택하신 날짜와 시간대에 대한 예약 가능 여부를 확인하고 있습니다. 이 과정은 몇 분이 소요될
				수 있습니다.
			</p>
		</div>

		<div class="loading-indicator">
			스크래핑 진행 중... <span class="spinner"></span>
		</div>
	{:else if loginStatus === 'completed' && results}
		<div class="info-box {results.available ? 'success' : ''}">
			<h3>예약 확인 완료</h3>
			{#if results.available}
				<p>
					<strong>예약 가능!</strong> 선택하신 날짜와 시간대에 예약 가능한 슬롯이 있습니다.
				</p>
			{:else}
				<p>선택하신 날짜와 시간대에 예약 가능한 슬롯이 없습니다.</p>
			{/if}
		</div>

		{#if results.available && results.slots && results.slots.length > 0}
			<div class="results-container">
				<h4>예약 가능한 시간대 ({results.slots.length}개)</h4>
				<ul class="time-slots-list">
					{#each results.slots as slot}
						<li>
							<span class="time">{slot.time}</span>
							<a href={slot.link} target="_blank" rel="noopener noreferrer"> 예약하기 </a>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		<div class="button-container">
			<button on:click={resetProcess}> 새 검색 시작하기 </button>
		</div>
	{:else if loginStatus === 'error'}
		<div class="info-box error">
			<h3>오류 발생</h3>
			<p>{errorMessage || '알 수 없는 오류가 발생했습니다.'}</p>
		</div>

		<div class="button-container">
			<button on:click={resetProcess}> 다시 시도하기 </button>
		</div>
	{/if}
</div>

<style>
	.manual-login-container {
		max-width: 600px;
		margin: 0 auto;
		padding: 20px;
		font-family: Arial, sans-serif;
	}

	h2 {
		text-align: center;
		margin-bottom: 20px;
		color: #2c3e50;
	}

	.info-box {
		background-color: #f8f9fa;
		border-radius: 6px;
		padding: 16px;
		margin-bottom: 20px;
		border-left: 4px solid #3498db;
	}

	.info-box.success {
		border-left-color: #2ecc71;
	}

	.info-box.error {
		border-left-color: #e74c3c;
	}

	.button-container {
		display: flex;
		justify-content: center;
		gap: 12px;
		margin-top: 20px;
	}

	button {
		background-color: #3498db;
		color: white;
		border: none;
		padding: 10px 20px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 16px;
		transition: background-color 0.3s;
	}

	button:hover {
		background-color: #2980b9;
	}

	button:disabled {
		background-color: #95a5a6;
		cursor: not-allowed;
	}

	.secondary-button {
		background-color: #7f8c8d;
	}

	.secondary-button:hover {
		background-color: #6c7a7d;
	}

	.loading-indicator {
		text-align: center;
		margin: 20px 0;
		color: #7f8c8d;
	}

	.spinner {
		display: inline-block;
		width: 16px;
		height: 16px;
		border: 2px solid rgba(0, 0, 0, 0.1);
		border-left-color: #3498db;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		vertical-align: middle;
		margin-left: 8px;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.form-container {
		background-color: #f8f9fa;
		border-radius: 6px;
		padding: 16px;
		margin-bottom: 20px;
	}

	.form-group {
		margin-bottom: 16px;
	}

	label {
		display: block;
		margin-bottom: 6px;
		font-weight: bold;
		color: #2c3e50;
	}

	input,
	select {
		width: 100%;
		padding: 10px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 16px;
	}

	.results-container {
		background-color: #f8f9fa;
		border-radius: 6px;
		padding: 16px;
		margin-bottom: 20px;
	}

	.time-slots-list {
		list-style-type: none;
		padding: 0;
	}

	.time-slots-list li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px;
		border-bottom: 1px solid #ddd;
	}

	.time-slots-list li:last-child {
		border-bottom: none;
	}

	.time-slots-list .time {
		font-weight: bold;
	}

	.time-slots-list a {
		background-color: #2ecc71;
		color: white;
		text-decoration: none;
		padding: 6px 12px;
		border-radius: 4px;
	}

	.time-slots-list a:hover {
		background-color: #27ae60;
	}
</style>
