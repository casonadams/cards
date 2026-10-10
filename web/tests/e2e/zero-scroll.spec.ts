import { test, expect, type Page } from '@playwright/test';

/**
 * Helper to set player name on landing screen if not already set.
 */
async function setPlayerName(page: Page, name: string): Promise<void> {
	const nameInput = page.getByPlaceholder('Enter your name...');
	if (await nameInput.isVisible()) {
		await nameInput.fill(name);
		const saveButton = page.getByRole('button', { name: 'Save' });
		if (await saveButton.isVisible()) {
			await saveButton.click();
			await page.waitForTimeout(200);
		}
	}
}

/**
 * Creates a table for the given game name and player count.
 */
async function createTable(page: Page, gameName: string, playerCount: number): Promise<void> {
	// Select the exact game button in the table selector grid
	const gameButton = page
		.locator('.grid.grid-cols-2 button')
		.filter({ has: page.locator('span.block.text-base', { hasText: new RegExp(`^\\s*${gameName}\\s*$`) }) })
		.first();
	await expect(gameButton).toBeVisible();
	await gameButton.click();
	await page.waitForTimeout(200);

	// Select player count
	const countButton = page.locator(`button[data-player-count="${playerCount}"]`).first();
	await expect(countButton).toBeVisible();
	await countButton.click();
	await page.waitForTimeout(200);

	// Click Create Table
	const createButton = page.getByRole('button', { name: 'Create Table' });
	await expect(createButton).toBeVisible();
	await createButton.click();

	// Wait for room to be created and lobby to appear
	await page.waitForFunction(() => window.location.hash.includes('code='), null, {
		timeout: 15000
	});
	await expect(page.getByText('Waiting Room')).toBeVisible({ timeout: 10000 });
}

/**
 * Fills waiting room with AI players up to totalCapacity and starts game.
 */
async function fillWithAiAndStartGame(page: Page, totalCapacity: number): Promise<void> {
	const addAiButton = page.getByRole('button', { name: '+ Add AI Player' });

	// In the waiting room, Host is already 1 player. We need totalCapacity - 1 AI players.
	for (let i = 0; i < totalCapacity - 1; i++) {
		await expect(addAiButton).toBeVisible();
		await addAiButton.click();
		await page.waitForTimeout(250);
	}

	// Click Start Game
	const startButton = page.getByRole('button', { name: 'Start Game' });
	await expect(startButton).toBeVisible();
	await startButton.click();

	// Wait for felt table surface to mount
	await expect(page.locator('.felt-table-surface')).toBeVisible({ timeout: 15000 });
	await page.waitForTimeout(500);
}

/**
 * Asserts the mobile zero-scroll invariant:
 * document.documentElement.scrollHeight <= window.innerHeight + 1
 */
async function assertZeroScroll(page: Page, orientation: 'portrait' | 'landscape'): Promise<void> {
	const metrics = await page.evaluate(() => ({
		scrollHeight: document.documentElement.scrollHeight,
		clientHeight: window.innerHeight,
		bodyScrollHeight: document.body.scrollHeight,
		windowHeight: window.innerHeight
	}));

	expect(
		metrics.scrollHeight,
		`Zero-scroll violated in ${orientation}: scrollHeight (${metrics.scrollHeight}px) > clientHeight (${metrics.clientHeight}px)`
	).toBeLessThanOrEqual(metrics.clientHeight + 1);

	// Ensure crucial UI components are visible without scrolling
	const handSlot = page.locator('.card-hand-slot').first();
	await expect(handSlot).toBeVisible();

	const playerBadges = page.locator('[data-player-id]');
	expect(await playerBadges.count()).toBeGreaterThanOrEqual(1);

	const leaveButton = page.getByRole('button', { name: 'Leave Game' });
	await expect(leaveButton).toBeVisible();
}

if (typeof (globalThis as any).Bun === 'undefined') {
	test.describe('Mobile Viewport Zero-Scroll Invariants', () => {
	test('iPhone Portrait (390x844) & Landscape (844x390) Zero-Scroll on Canadian Salad', async ({
		browser
	}) => {
		const context = await browser.newContext({
			viewport: { width: 390, height: 844 }
		});
		const page = await context.newPage();

		try {
			await page.goto('/');
			await setPlayerName(page, 'ZeroScrollTester');
			await createTable(page, 'Canadian Salad', 4);
			await fillWithAiAndStartGame(page, 4);

			// 1. Verify iPhone portrait zero-scroll
			await assertZeroScroll(page, 'portrait');

			// 2. Switch to iPhone landscape (844x390)
			await page.setViewportSize({ width: 844, height: 390 });
			await page.waitForTimeout(500);

			// Verify iPhone landscape zero-scroll
			await assertZeroScroll(page, 'landscape');
		} finally {
			await context.close();
		}
	});

	test('iPhone Portrait (390x844) & Landscape (844x390) Zero-Scroll on Oh Well', async ({
		browser
	}) => {
		const context = await browser.newContext({
			viewport: { width: 390, height: 844 }
		});
		const page = await context.newPage();

		try {
			await page.goto('/');
			await setPlayerName(page, 'ZeroScrollTester2');
			await createTable(page, 'Oh Well', 4);
			await fillWithAiAndStartGame(page, 4);

			// 1. Verify iPhone portrait zero-scroll
			await assertZeroScroll(page, 'portrait');

			// 2. Switch to iPhone landscape (844x390)
			await page.setViewportSize({ width: 844, height: 390 });
			await page.waitForTimeout(500);

			// Verify iPhone landscape zero-scroll
			await assertZeroScroll(page, 'landscape');
		} finally {
			await context.close();
		}
	});

	test('Dynamically discover and verify zero-scroll across all registered games', async ({
		browser
	}) => {
		const context = await browser.newContext({
			viewport: { width: 390, height: 844 }
		});
		const page = await context.newPage();

		try {
			await page.goto('/');
			await setPlayerName(page, 'DiscoverTester');

			// Read available game buttons from the Table Selector
			const tableSelector = page.locator('.grid.grid-cols-2 button');
			const gameCount = await tableSelector.count();
			expect(gameCount).toBeGreaterThanOrEqual(8);

			const gameNames: string[] = [];
			for (let i = 0; i < gameCount; i++) {
				const text = await tableSelector.nth(i).locator('span.block.text-base').textContent();
				if (text) gameNames.push(text.trim());
			}
			console.log('Discovered games for zero-scroll verification:', gameNames);

			// Verify each discovered game
			for (const gName of gameNames) {
				// Navigate fresh for each game
				await page.goto('/');
				await setPlayerName(page, 'DiscoverTester');
				const targetCapacity = (gName === 'Cribbage' || gName === 'Gin Rummy') ? 2 : 4;
				await createTable(page, gName, targetCapacity);
				await fillWithAiAndStartGame(page, targetCapacity);

				// Portrait check
				await assertZeroScroll(page, 'portrait');

				// Landscape check
				await page.setViewportSize({ width: 844, height: 390 });
				await page.waitForTimeout(400);
				await assertZeroScroll(page, 'landscape');

				// Reset to portrait for next iteration
				await page.setViewportSize({ width: 390, height: 844 });
			}
		} finally {
			await context.close();
		}
	});

	test('iPhone Portrait (390x844) & Landscape (844x390) Zero-Scroll on Spades 6P Extreme Hand (17 cards)', async ({
		browser
	}) => {
		const context = await browser.newContext({
			viewport: { width: 390, height: 844 }
		});
		const page = await context.newPage();

		const pageErrors: string[] = [];
		page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.text()));
		page.on('pageerror', (err) => {
			console.log('BROWSER PAGEERROR:', err.message);
			pageErrors.push(err.message);
		});

		try {
			await page.goto('/');
			await setPlayerName(page, 'ExtremeHandTester');
			await createTable(page, 'Spades', 6);
			await fillWithAiAndStartGame(page, 6);

			// Wait for hand cards to be mounted and rendered
			await page.locator('.card-hand-slot').first().waitFor({ state: 'visible', timeout: 10000 });

			// Assert cards dealt in hand (17 cards in 6-player double-deck Spades)
			const cardsCount = await page.locator('.card-hand-slot').count();
			expect(cardsCount).toBe(17);

			// 1. Verify iPhone portrait zero-scroll
			await assertZeroScroll(page, 'portrait');

			// 2. Switch to iPhone landscape (844x390)
			await page.setViewportSize({ width: 844, height: 390 });
			await page.waitForTimeout(500);

			// Verify iPhone landscape zero-scroll
			await assertZeroScroll(page, 'landscape');

			// Verify no runtime crashes occurred (e.g. Svelte each_key_duplicate)
			expect(pageErrors).toEqual([]);
		} finally {
			await context.close();
		}
	});
});
}

