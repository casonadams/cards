import { test, expect } from '@playwright/test';

if (typeof (globalThis as any).Bun === 'undefined') {
	test('Spades contract bidding modal appears, bots bid in sequence, and user can submit bid', async ({ page }) => {
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

		// Start game
		const startButton = page.getByRole('button', { name: 'Start Game' });
		await expect(startButton).toBeVisible();
		await startButton.click();

		// Verify that Spades Contract Bidding modal appears!
		const biddingBadge = page.getByText('Spades — Contract Bidding');
		await expect(biddingBadge).toBeVisible({ timeout: 10000 });

		// Wait for Host's turn to confirm bid (AI bots 1, 2, 3 bid in sequence)
		const confirmButton = page.getByRole('button', { name: /Confirm/i });
		await expect(confirmButton).toBeVisible({ timeout: 15000 });

		// Take screenshot of bidding modal
		await page.screenshot({ path: '/home/tyson/.gemini/antigravity/brain/e8870d59-bbcb-47fc-80b3-58c5c93c12d0/spades_bidding_modal.png' });

		await confirmButton.click();

		// Once all bids are confirmed, the bidding modal dismisses and trick playing begins!
		await expect(biddingBadge).not.toBeVisible({ timeout: 10000 });

		// Verify table is in playing phase
		await expect(page.locator('.felt-table-surface')).toBeVisible();

		// Take screenshot of active trick table
		await page.screenshot({ path: '/home/tyson/.gemini/antigravity/brain/e8870d59-bbcb-47fc-80b3-58c5c93c12d0/spades_playing_phase.png' });
	});
}

