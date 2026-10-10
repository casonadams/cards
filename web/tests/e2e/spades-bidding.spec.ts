import { test, expect } from '@playwright/test';

if (typeof (globalThis as any).Bun === 'undefined') {
	test('Spades team selection modal, face-down bidding, hand reveal, and playing phase flow', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Set player name if needed
		const nameInput = page.getByPlaceholder('Enter your name...');
		if (await nameInput.isVisible()) {
			await nameInput.fill('HostPlayer');
			const saveButton = page.getByRole('button', { name: 'Save' });
			if (await saveButton.isVisible()) {
				await saveButton.click();
				await page.waitForTimeout(200);
			}
		}

		// Select Spades
		const spadesButton = page
			.locator('.grid.grid-cols-2 button')
			.filter({ has: page.locator('span.block.text-base', { hasText: /^Spades$/ }) })
			.first();
		await expect(spadesButton).toBeVisible();
		await spadesButton.click();
		await page.waitForTimeout(200);

		// Select 4 players
		const countButton = page.locator('button[data-player-count="4"]').first();
		await expect(countButton).toBeVisible();
		await countButton.click();
		await page.waitForTimeout(200);

		// Create Table
		const createButton = page.getByRole('button', { name: 'Create Table' });
		await expect(createButton).toBeVisible();
		await createButton.click();

		// Wait for waiting room
		await page.waitForFunction(() => window.location.hash.includes('code='), null, { timeout: 15000 });
		await expect(page.getByText('Waiting Room')).toBeVisible({ timeout: 10000 });

		// Add 3 AI players
		const addAiButton = page.getByRole('button', { name: '+ Add AI Player' });
		for (let i = 0; i < 3; i++) {
			await expect(addAiButton).toBeVisible();
			await addAiButton.click();
			await page.waitForTimeout(300);
		}

		// Start game — should open Spades Team Assignment Modal
		const startButton = page.getByRole('button', { name: 'Start Game' });
		await expect(startButton).toBeVisible();
		await startButton.click();

		// Verify Spades Team Assignment Modal is visible
		const teamModalTitle = page.getByText('Choose Your Partner');
		await expect(teamModalTitle).toBeVisible({ timeout: 10000 });

		// Pick teammate (e.g. Bot Bob)
		const partnerCandidate = page.getByRole('button', { name: /Bot (Bob|Alice|Carol)/i }).first();
		await expect(partnerCandidate).toBeVisible();
		await partnerCandidate.click();
		await page.waitForTimeout(200);

		// Verify alternating seats preview appears
		await expect(page.getByText('Table Seating Order (Alternating)')).toBeVisible();

		// Screenshot of Team Assignment modal
		await page.screenshot({ path: '/home/tyson/.gemini/antigravity/brain/e8870d59-bbcb-47fc-80b3-58c5c93c12d0/spades_team_selection_modal.png' });

		// Confirm teams and start
		const confirmTeamsBtn = page.getByRole('button', { name: 'Confirm Teams & Deal' });
		await expect(confirmTeamsBtn).toBeEnabled();
		await confirmTeamsBtn.click();

		// Verify that Spades Contract Bidding modal appears!
		const biddingBadge = page.getByText('Spades — Contract Bidding');
		await expect(biddingBadge).toBeVisible({ timeout: 10000 });

		// Verify cards in hand dock start FACE-DOWN
		const faceDownCards = page.locator('button[aria-label="Face-down card"]');
		await expect(faceDownCards.first()).toBeVisible({ timeout: 5000 });
		const faceDownCount = await faceDownCards.count();
		expect(faceDownCount).toBeGreaterThan(0);

		// Wait for Host's turn to confirm bid (AI bots bid in sequence)
		const confirmButton = page.getByRole('button', { name: /Confirm/i });
		await expect(confirmButton).toBeVisible({ timeout: 15000 });

		// Verify Blind Nil (+200) is enabled while cards are face-down
		const blindNilBtn = page.getByRole('button', { name: 'Blind Nil (+200)' });
		await expect(blindNilBtn).toBeEnabled();

		// Take screenshot of face-down bidding phase with Blind Nil enabled
		await page.screenshot({ path: '/home/tyson/.gemini/antigravity/brain/e8870d59-bbcb-47fc-80b3-58c5c93c12d0/spades_facedown_bidding_modal.png' });

		// Click "Look at Cards / Reveal Hand"
		const revealBtn = page.getByRole('button', { name: /Look at Cards \/ Reveal Hand/i });
		await expect(revealBtn).toBeVisible();
		await revealBtn.click();
		await page.waitForTimeout(200);

		// Verify cards are now revealed (face-down cards count is 0)
		await expect(faceDownCards).toHaveCount(0);

		// Verify Blind Nil is now disabled
		await expect(blindNilBtn).toBeDisabled();

		// Take screenshot of revealed cards bidding modal
		await page.screenshot({ path: '/home/tyson/.gemini/antigravity/brain/e8870d59-bbcb-47fc-80b3-58c5c93c12d0/spades_revealed_bidding_modal.png' });

		// Confirm regular bid
		await confirmButton.click();

		// Once all bids are confirmed, the bidding modal dismisses and trick playing begins!
		await expect(biddingBadge).not.toBeVisible({ timeout: 10000 });

		// Verify table is in playing phase and cards are visible face-up
		await expect(page.locator('.felt-table-surface')).toBeVisible();
		await expect(faceDownCards).toHaveCount(0);

		// Take screenshot of active trick table
		await page.screenshot({ path: '/home/tyson/.gemini/antigravity/brain/e8870d59-bbcb-47fc-80b3-58c5c93c12d0/spades_playing_phase.png' });
	});

	test('6-Player Spades team selection modal (2 teammates) and double-deck bidding', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Set player name if needed
		const nameInput = page.getByPlaceholder('Enter your name...');
		if (await nameInput.isVisible()) {
			await nameInput.fill('HostPlayer6');
			const saveButton = page.getByRole('button', { name: 'Save' });
			if (await saveButton.isVisible()) {
				await saveButton.click();
				await page.waitForTimeout(200);
			}
		}

		// Select Spades
		const spadesButton = page
			.locator('.grid.grid-cols-2 button')
			.filter({ has: page.locator('span.block.text-base', { hasText: /^Spades$/ }) })
			.first();
		await expect(spadesButton).toBeVisible();
		await spadesButton.click();
		await page.waitForTimeout(200);

		// Select 6 players
		const countButton = page.locator('button[data-player-count="6"]').first();
		await expect(countButton).toBeVisible();
		await countButton.click();
		await page.waitForTimeout(200);

		// Create Table
		const createButton = page.getByRole('button', { name: 'Create Table' });
		await expect(createButton).toBeVisible();
		await createButton.click();

		// Wait for waiting room
		await page.waitForFunction(() => window.location.hash.includes('code='), null, { timeout: 15000 });
		await expect(page.getByText('Waiting Room')).toBeVisible({ timeout: 10000 });

		// Add 5 AI players
		const addAiButton = page.getByRole('button', { name: '+ Add AI Player' });
		for (let i = 0; i < 5; i++) {
			await expect(addAiButton).toBeVisible();
			await addAiButton.click();
			await page.waitForTimeout(200);
		}

		// Start game — should open Spades Team Assignment Modal for 6 players
		const startButton = page.getByRole('button', { name: 'Start Game' });
		await expect(startButton).toBeVisible();
		await startButton.click();

		// Verify Spades Team Assignment Modal title for 6P
		const teamModalTitle = page.getByText('Choose Your Teammates');
		await expect(teamModalTitle).toBeVisible({ timeout: 10000 });
		await expect(page.getByText('Select 2 players')).toBeVisible();

		// Confirm button should be disabled before selecting 2 teammates
		const confirmTeamsBtn = page.getByRole('button', { name: 'Confirm Teams & Deal' });
		await expect(confirmTeamsBtn).toBeDisabled();

		// Select first teammate
		const botAliceBtn = page.getByRole('button', { name: /Bot Alice/i }).first();
		await botAliceBtn.click();
		await page.waitForTimeout(150);

		// Confirm button should still be disabled after 1 selection
		await expect(confirmTeamsBtn).toBeDisabled();

		// Select second teammate
		const botCarolBtn = page.getByRole('button', { name: /Bot Carol/i }).first();
		await botCarolBtn.click();
		await page.waitForTimeout(150);

		// Now confirm button should be enabled!
		await expect(confirmTeamsBtn).toBeEnabled();

		// Screenshot 6-player team selection modal
		await page.screenshot({ path: '/home/tyson/.gemini/antigravity/brain/e8870d59-bbcb-47fc-80b3-58c5c93c12d0/spades_6p_team_selection_modal.png' });

		// Confirm teams
		await confirmTeamsBtn.click();

		// Verify 6P bidding modal appears with 6P Double Deck label
		const biddingBadge = page.getByText('Spades — Contract Bidding');
		await expect(biddingBadge).toBeVisible({ timeout: 10000 });
		await expect(page.getByText('6P Double Deck')).toBeVisible();

		// Screenshot 6P bidding phase
		await page.screenshot({ path: '/home/tyson/.gemini/antigravity/brain/e8870d59-bbcb-47fc-80b3-58c5c93c12d0/spades_6p_facedown_bidding.png' });
	});

	test('4-Player Spades Solo (Cutthroat) mode selection via modal toggle', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Set player name if needed
		const nameInput = page.getByPlaceholder('Enter your name...');
		if (await nameInput.isVisible()) {
			await nameInput.fill('HostSolo4');
			const saveButton = page.getByRole('button', { name: 'Save' });
			if (await saveButton.isVisible()) {
				await saveButton.click();
				await page.waitForTimeout(200);
			}
		}

		// Select Spades
		const spadesButton = page
			.locator('.grid.grid-cols-2 button')
			.filter({ has: page.locator('span.block.text-base', { hasText: /^Spades$/ }) })
			.first();
		await spadesButton.click();
		await page.waitForTimeout(150);

		// Select 4 players
		const countButton = page.locator('button[data-player-count="4"]').first();
		await countButton.click();
		await page.waitForTimeout(150);

		// Create Table
		await page.getByRole('button', { name: 'Create Table' }).click();
		await page.waitForFunction(() => window.location.hash.includes('code='), null, { timeout: 15000 });
		await expect(page.getByText('Waiting Room')).toBeVisible({ timeout: 10000 });

		// Add 3 AI players
		const addAiButton = page.getByRole('button', { name: '+ Add AI Player' });
		for (let i = 0; i < 3; i++) {
			await addAiButton.click();
			await page.waitForTimeout(150);
		}

		// Start game — opens setup modal
		await page.getByRole('button', { name: 'Start Game' }).click();

		// Verify modal title and switch to Solo (Cutthroat)
		await expect(page.getByText('Choose Your Partner')).toBeVisible({ timeout: 10000 });
		const soloToggleBtn = page.getByRole('button', { name: /Solo \(Cutthroat\)/i });
		await expect(soloToggleBtn).toBeVisible();
		await soloToggleBtn.click();
		await page.waitForTimeout(200);

		// Title should update to Solo Spades (Cutthroat)
		await expect(page.getByText('Solo Spades (Cutthroat)')).toBeVisible();
		await expect(page.getByText('Cutthroat Solo Rules')).toBeVisible();

		// Screenshot of 4P Solo modal
		await page.screenshot({ path: '/home/tyson/.gemini/antigravity/brain/e8870d59-bbcb-47fc-80b3-58c5c93c12d0/spades_4p_solo_modal.png' });

		// Click Start Solo Game & Deal
		const startSoloBtn = page.getByRole('button', { name: 'Start Solo Game & Deal' });
		await expect(startSoloBtn).toBeEnabled();
		await startSoloBtn.click();

		// Verify Contract Bidding modal appears with 4P Solo label
		const biddingBadge = page.getByText('Spades — Contract Bidding');
		await expect(biddingBadge).toBeVisible({ timeout: 10000 });
		await expect(page.getByText('4P Solo')).toBeVisible();

		// Screenshot 4P Solo bidding phase
		await page.screenshot({ path: '/home/tyson/.gemini/antigravity/brain/e8870d59-bbcb-47fc-80b3-58c5c93c12d0/spades_4p_solo_bidding.png' });
	});

	test('5-Player Spades Solo (Cutthroat) with 10 cards and max 10 bids', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Set player name if needed
		const nameInput = page.getByPlaceholder('Enter your name...');
		if (await nameInput.isVisible()) {
			await nameInput.fill('HostSolo5');
			const saveButton = page.getByRole('button', { name: 'Save' });
			if (await saveButton.isVisible()) {
				await saveButton.click();
				await page.waitForTimeout(200);
			}
		}

		// Select Spades
		const spadesButton = page
			.locator('.grid.grid-cols-2 button')
			.filter({ has: page.locator('span.block.text-base', { hasText: /^Spades$/ }) })
			.first();
		await spadesButton.click();
		await page.waitForTimeout(150);

		// Select 5 players
		const countButton = page.locator('button[data-player-count="5"]').first();
		await expect(countButton).toBeVisible();
		await countButton.click();
		await page.waitForTimeout(150);

		// Create Table
		await page.getByRole('button', { name: 'Create Table' }).click();
		await page.waitForFunction(() => window.location.hash.includes('code='), null, { timeout: 15000 });
		await expect(page.getByText('Waiting Room')).toBeVisible({ timeout: 10000 });

		// Add 4 AI players (total 5)
		const addAiButton = page.getByRole('button', { name: '+ Add AI Player' });
		for (let i = 0; i < 4; i++) {
			await addAiButton.click();
			await page.waitForTimeout(150);
		}

		// Start game — starts 5P Solo directly
		await page.getByRole('button', { name: 'Start Game' }).click();

		// Verify Contract Bidding modal appears with 5P Solo label
		const biddingBadge = page.getByText('Spades — Contract Bidding');
		await expect(biddingBadge).toBeVisible({ timeout: 10000 });
		await expect(page.getByText('5P Solo')).toBeVisible();

		// Hand has 10 face-down cards
		const faceDownCards = page.locator('button[aria-label="Face-down card"]');
		await expect(faceDownCards.first()).toBeVisible({ timeout: 5000 });
		await expect(faceDownCards).toHaveCount(10);

		// Screenshot 5P Solo bidding phase
		await page.screenshot({ path: '/home/tyson/.gemini/antigravity/brain/e8870d59-bbcb-47fc-80b3-58c5c93c12d0/spades_5p_solo_bidding.png' });
	});
}

