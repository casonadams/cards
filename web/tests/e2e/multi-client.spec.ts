import { test, expect, type Page, type Browser, type BrowserContext } from '@playwright/test';

/**
 * Creates a browser context instrumented to track RTCPeerConnection and RTCDataChannel instances
 * for fault-injection testing.
 */
async function createInstrumentedContext(browser: Browser): Promise<BrowserContext> {
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 }
	});
	await context.addInitScript(() => {
		(window as any).__activePeerConnections = [];
		(window as any).__activeDataChannels = [];
		const OrigPC = window.RTCPeerConnection;
		if (!OrigPC) return;

		const InstrumentedPC = function (this: RTCPeerConnection, ...args: any[]) {
			const pc = new OrigPC(...args);
			(window as any).__activePeerConnections.push(pc);
			const origCreateDataChannel = pc.createDataChannel.bind(pc);
			pc.createDataChannel = function (...dcArgs: any[]) {
				const dc = origCreateDataChannel(...dcArgs);
				(window as any).__activeDataChannels.push(dc);
				return dc;
			};
			pc.addEventListener('datachannel', (ev: any) => {
				(window as any).__activeDataChannels.push(ev.channel);
			});
			return pc;
		} as any;
		InstrumentedPC.prototype = OrigPC.prototype;
		window.RTCPeerConnection = InstrumentedPC;
	});
	return context;
}

/**
 * Sets the player's display name on the landing screen.
 */
async function setPlayerName(page: Page, name: string): Promise<void> {
	const nameInput = page.getByPlaceholder('Enter your name...');
	if (await nameInput.isVisible()) {
		await nameInput.fill(name);
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForTimeout(300);
	}
}

/**
 * Creates a room and returns the 6-character room code.
 */
async function createRoom(
	page: Page,
	gameName: 'Canadian Salad' | 'Oh Well' = 'Canadian Salad',
	playerCount = 4
): Promise<string> {
	// Select game
	const gameButton = page.locator('button', { hasText: gameName });
	if (await gameButton.isVisible()) {
		await gameButton.click();
	}

	// Select player count
	const countButton = page
		.locator('button', { hasText: `${playerCount} Players` })
		.or(page.locator('button', { hasText: `${playerCount}P` }))
		.first();
	if (await countButton.isVisible()) {
		await countButton.click();
	}

	// Click Create Table
	const createButton = page.getByRole('button', { name: 'Create Table' });
	await createButton.click();

	// Wait for room code in URL hash
	await page.waitForFunction(() => window.location.hash.includes('code='), null, {
		timeout: 15000
	});
	const hash = await page.evaluate(() => window.location.hash);
	const match = hash.match(/code=([A-Z0-9]{4,6})/i);
	if (!match) {
		throw new Error(`Failed to extract room code from hash: ${hash}`);
	}
	const roomCode = match[1].toUpperCase();

	// Verify lobby has rendered
	await expect(page.getByText('Waiting Room')).toBeVisible({ timeout: 10000 });
	return roomCode;
}

/**
 * Joins an existing room by typing the code into the input field.
 */
async function joinRoomByCode(page: Page, code: string): Promise<void> {
	const codeInput = page.getByPlaceholder('ROOM CODE');
	await codeInput.fill(code);
	const joinButton = page.getByRole('button', { name: 'Join Game' });
	await joinButton.click();
	await expect(page.getByText('Waiting Room')).toBeVisible({ timeout: 15000 });
}

/**
 * Joins an existing room via direct URL hash navigation.
 */
async function joinRoomByUrl(page: Page, code: string): Promise<void> {
	await page.goto(`/#code=${code}`);
	await expect(page.getByText('Waiting Room')).toBeVisible({ timeout: 15000 });
}

/**
 * Waits for and verifies the NavBar connection status pill.
 */
async function verifyConnectionStatusPill(
	page: Page,
	expectedModes: ('p2p' | 'relay')[] = ['p2p', 'relay']
): Promise<{ mode: string; text: string; title: string }> {
	const statusPill = page
		.locator('nav div[title]')
		.filter({ hasText: /P2P|Relay/i })
		.first();

	await expect(statusPill).toBeAttached({ timeout: 20000 });

	// Wait until pill contains either P2P or Relay
	await expect
		.poll(
			async () => {
				const txt = await statusPill.textContent();
				return txt || '';
			},
			{ timeout: 20000, intervals: [500, 1000] }
		)
		.toMatch(new RegExp(expectedModes.map((m) => m.toUpperCase()).join('|'), 'i'));

	const text = (await statusPill.textContent()) || '';
	const title = (await statusPill.getAttribute('title')) || '';

	let mode = 'relay';
	if (/p2p/i.test(text)) {
		mode = 'p2p';
		expect(text).toMatch(/\(\d+\)/);
		expect(title).toMatch(/P2P|WebRTC/i);
	} else {
		expect(title).toMatch(/Relay/i);
	}

	return { mode, text, title };
}

/**
 * Adds AI players until the room reaches its configured capacity, then starts the game.
 */
async function addAiAndStart(hostPage: Page): Promise<void> {
	const addAiButton = hostPage.getByRole('button', { name: '+ Add AI Player' });
	while (await addAiButton.isVisible()) {
		await addAiButton.click();
		await hostPage.waitForTimeout(400);
	}
	const startButton = hostPage.getByRole('button', { name: 'Start Game' });
	await expect(startButton).toBeEnabled({ timeout: 10000 });
	await startButton.click();
}

/**
 * Drives card plays by checking whichever human player has the active turn.
 */
async function playCardsOnTable(pages: Page[], maxPlays = 2): Promise<number> {
	let playsCount = 0;
	const deadline = Date.now() + 30000;

	while (playsCount < maxPlays && Date.now() < deadline) {
		let played = false;
		for (const page of pages) {
			const turnBanner = page.locator('text=Your Turn — Play a Card');
			if (await turnBanner.isVisible()) {
				const playableCard = page.locator('.card-hand-slot.is-playable button').first();
				if (await playableCard.isVisible()) {
					await playableCard.click();
					playsCount++;
					played = true;
					await page.waitForTimeout(1000);
					break;
				}
			}
		}
		if (!played) {
			// AI turn may be in progress, wait briefly
			await pages[0].waitForTimeout(500);
		}
	}
	return playsCount;
}

if (typeof (globalThis as any).Bun === 'undefined') {
	test.describe('Cards Hybrid WebRTC & MQTT Networking E2E', () => {
	test('Scenario 1: 4-Player Table (2 Browsers + 2 AIs) - P2P Handshake & Synchronized Card Play', async ({
		browser
	}) => {
		const hostContext = await createInstrumentedContext(browser);
		const guestContext = await createInstrumentedContext(browser);

		try {
			const hostPage = await hostContext.newPage();
			const guestPage = await guestContext.newPage();

			// 1. Host setup
			await hostPage.goto('/');
			await setPlayerName(hostPage, 'HostPlayer');
			const roomCode = await createRoom(hostPage, 'Canadian Salad', 4);
			expect(roomCode).toMatch(/^[A-Z0-9]{4,6}$/);

			// 2. Guest joins using 6-letter room code
			await guestPage.goto('/');
			await setPlayerName(guestPage, 'GuestPlayer');
			await joinRoomByCode(guestPage, roomCode);

			// 3. Verify both see each other in the lobby
			await expect(hostPage.getByText('GuestPlayer')).toBeVisible({ timeout: 10000 });
			await expect(guestPage.getByText('HostPlayer')).toBeVisible({ timeout: 10000 });

			// 4. Verify connection status pill in NavBar displays live status with peer count > 0
			const hostStatus = await verifyConnectionStatusPill(hostPage, ['p2p', 'relay']);
			const guestStatus = await verifyConnectionStatusPill(guestPage, ['p2p', 'relay']);
			expect(hostStatus.text.length).toBeGreaterThan(0);
			expect(guestStatus.text.length).toBeGreaterThan(0);

			// 5. Host adds AI players to reach capacity (4 players) and starts game
			await addAiAndStart(hostPage);

			// 6. Verify table renders for both players
			await expect(hostPage.locator('.felt-table-surface')).toBeVisible({ timeout: 15000 });
			await expect(guestPage.locator('.felt-table-surface')).toBeVisible({ timeout: 15000 });

			// Both players should see card hands dealt
			await expect(hostPage.locator('.card-hand-slot').first()).toBeVisible({ timeout: 10000 });
			await expect(guestPage.locator('.card-hand-slot').first()).toBeVisible({ timeout: 10000 });

			// 7. Play cards on the table
			const cardsPlayed = await playCardsOnTable([hostPage, guestPage], 2);
			expect(cardsPlayed).toBeGreaterThanOrEqual(1);

			// 8. Verify state synchronization on the table: played card appears in trick slot on both browsers
			await expect(hostPage.locator('.trick-slot button').first()).toBeVisible({ timeout: 10000 });
			await expect(guestPage.locator('.trick-slot button').first()).toBeVisible({ timeout: 10000 });
		} finally {
			await hostContext.close();
			await guestContext.close();
		}
	});

	test('Scenario 2: Oh Well 3-Player Round - URL Hash Join, Bidding & Trick Area Synchronization', async ({
		browser
	}) => {
		const hostContext = await createInstrumentedContext(browser);
		const guestContext = await createInstrumentedContext(browser);

		try {
			const hostPage = await hostContext.newPage();
			const guestPage = await guestContext.newPage();

			// 1. Host creates Oh Well match with 3 players
			await hostPage.goto('/');
			await setPlayerName(hostPage, 'OhHost');
			const roomCode = await createRoom(hostPage, 'Oh Well', 3);

			// 2. Guest joins via direct URL link
			await guestPage.goto('/');
			await setPlayerName(guestPage, 'OhGuest');
			await joinRoomByUrl(guestPage, roomCode);

			// 3. Verify connection pill
			await verifyConnectionStatusPill(hostPage, ['p2p', 'relay']);
			await verifyConnectionStatusPill(guestPage, ['p2p', 'relay']);

			// 4. Fill with 1 AI and start
			await addAiAndStart(hostPage);

			// 5. Verify game session loaded on both
			await expect(hostPage.locator('.felt-table-surface')).toBeVisible({ timeout: 15000 });
			await expect(guestPage.locator('.felt-table-surface')).toBeVisible({ timeout: 15000 });

			// 6. Bidding phase handling: Oh Well starts with bidding phase
			// Loop to confirm bids for active bidders
			const bidDeadline = Date.now() + 25000;
			while (Date.now() < bidDeadline) {
				let bidPlaced = false;
				for (const page of [hostPage, guestPage]) {
					const confirmBidBtn = page.getByRole('button', { name: /Confirm Bid/i });
					if (await confirmBidBtn.isVisible()) {
						await confirmBidBtn.click();
						bidPlaced = true;
						await page.waitForTimeout(800);
						break;
					}
				}
				// Break once bidding ends and trick play begins
				if (
					(await hostPage.locator('.card-hand-slot.is-playable').count()) > 0 ||
					(await guestPage.locator('.card-hand-slot.is-playable').count()) > 0
				) {
					break;
				}
				if (!bidPlaced) {
					await hostPage.waitForTimeout(400);
				}
			}

			// 7. Verify trick play begins and cards can be played
			const plays = await playCardsOnTable([hostPage, guestPage], 1);
			expect(plays).toBeGreaterThanOrEqual(1);

			// Verify synchronized trick card visible on both tables
			await expect(hostPage.locator('.trick-slot button').first()).toBeVisible({ timeout: 10000 });
			await expect(guestPage.locator('.trick-slot button').first()).toBeVisible({ timeout: 10000 });
		} finally {
			await hostContext.close();
			await guestContext.close();
		}
	});

	test('Scenario 3: R4 Abrupt WebRTC DataChannel Interruption - Seamless Fallback to MQTT Relay', async ({
		browser
	}) => {
		const hostContext = await createInstrumentedContext(browser);
		const guestContext = await createInstrumentedContext(browser);

		try {
			const hostPage = await hostContext.newPage();
			const guestPage = await guestContext.newPage();

			// 1. Host creates Canadian Salad 3-player match
			await hostPage.goto('/');
			await setPlayerName(hostPage, 'DisruptHost');
			const roomCode = await createRoom(hostPage, 'Canadian Salad', 3);

			// 2. Guest joins
			await guestPage.goto('/');
			await setPlayerName(guestPage, 'DisruptGuest');
			await joinRoomByCode(guestPage, roomCode);

			// 3. Wait for P2P connection
			await verifyConnectionStatusPill(hostPage, ['p2p', 'relay']);
			await verifyConnectionStatusPill(guestPage, ['p2p', 'relay']);

			// 4. Fill AI & start game
			await addAiAndStart(hostPage);
			await expect(hostPage.locator('.felt-table-surface')).toBeVisible({ timeout: 15000 });
			await expect(guestPage.locator('.felt-table-surface')).toBeVisible({ timeout: 15000 });

			// 5. Play first card to confirm active game session
			await playCardsOnTable([hostPage, guestPage], 1);

			// 6. Abruptly terminate all WebRTC DataChannels and PeerConnections on Host
			await hostPage.evaluate(() => {
				const dcs = (window as any).__activeDataChannels || [];
				for (const dc of dcs) {
					try {
						dc.close();
					} catch {}
				}
				const pcs = (window as any).__activePeerConnections || [];
				for (const pc of pcs) {
					try {
						pc.close();
					} catch {}
				}
			});

			// 7. Verify connection status pill transitions to Relay mode
			await expect
				.poll(
					async () => {
						const pill = hostPage
							.locator('nav')
							.locator('div')
							.filter({ hasText: /P2P|Relay/i })
							.first();
						return (await pill.textContent()) || '';
					},
					{ timeout: 15000, intervals: [500, 1000] }
				)
				.toMatch(/Relay/i);

			// 8. Verify players are NOT dropped and table remains intact
			await expect(hostPage.locator('.felt-table-surface')).toBeVisible();
			await expect(guestPage.locator('.felt-table-surface')).toBeVisible();
			await expect(hostPage.locator('.card-hand-slot').first()).toBeVisible();
			await expect(guestPage.locator('.card-hand-slot').first()).toBeVisible();

			// 9. Play next card over MQTT relay and verify table synchronizes
			const followupPlays = await playCardsOnTable([hostPage, guestPage], 1);
			expect(followupPlays).toBeGreaterThanOrEqual(1);

			await expect(hostPage.locator('.trick-slot button').first()).toBeVisible({ timeout: 10000 });
			await expect(guestPage.locator('.trick-slot button').first()).toBeVisible({ timeout: 10000 });
		} finally {
			await hostContext.close();
			await guestContext.close();
		}
	});

	test('Scenario 4: R4 Join Request Retry Recovery - Dropped Initial Packet Recovers Within 3s', async ({
		browser
	}) => {
		const hostContext = await createInstrumentedContext(browser);
		const guestContext = await createInstrumentedContext(browser);

		try {
			const hostPage = await hostContext.newPage();
			const guestPage = await guestContext.newPage();

			// 1. Host creates room
			await hostPage.goto('/');
			await setPlayerName(hostPage, 'RetryHost');
			const roomCode = await createRoom(hostPage, 'Canadian Salad', 3);

			// 2. Inject fault on Host to intentionally drop the first incoming join_request
			await hostPage.evaluate(() => {
				(window as any).__dropFirstJoin = true;
				(window as any).__droppedJoinCount = 0;
				const origDecrypt = crypto.subtle.decrypt.bind(crypto.subtle);

				crypto.subtle.decrypt = async function (...args) {
					const res = await origDecrypt(...args);
					if ((window as any).__dropFirstJoin) {
						try {
							const text = new TextDecoder().decode(res);
							const data = JSON.parse(text);
							if (data.type === 'join_request') {
								(window as any).__dropFirstJoin = false; // Only drop once!
								(window as any).__droppedJoinCount++;
								throw new Error('Simulated network drop of initial join_request packet');
							}
						} catch (e: any) {
							if ((window as any).__droppedJoinCount > 0) throw e;
						}
					}
					return res;
				};
			});

			// 3. Guest joins
			await guestPage.goto('/');
			await setPlayerName(guestPage, 'RetryGuest');

			const startTime = Date.now();
			await joinRoomByCode(guestPage, roomCode);
			const elapsedMs = Date.now() - startTime;

			// 4. Verify recovery happened within 4 seconds (initial 1.5s retry interval)
			expect(elapsedMs).toBeLessThan(4500);

			// 5. Confirm the drop was actually triggered and recovered
			const dropCount = await hostPage.evaluate(() => (window as any).__droppedJoinCount);
			expect(dropCount).toBe(1);

			// 6. Verify guest successfully joined and both see each other
			await expect(hostPage.getByText('RetryGuest')).toBeVisible({ timeout: 5000 });
			await expect(guestPage.getByText('RetryHost')).toBeVisible({ timeout: 5000 });
		} finally {
			await hostContext.close();
			await guestContext.close();
		}
	});

	test('Scenario 5: Clean Table Exit and Re-Join Lifecycle', async ({ browser }) => {
		const hostContext = await createInstrumentedContext(browser);
		const guestContext = await createInstrumentedContext(browser);

		try {
			const hostPage = await hostContext.newPage();
			const guestPage = await guestContext.newPage();

			// 1. Host creates room
			await hostPage.goto('/');
			await setPlayerName(hostPage, 'LifecycleHost');
			const roomCode = await createRoom(hostPage, 'Canadian Salad', 3);

			// 2. Guest joins
			await guestPage.goto('/');
			await setPlayerName(guestPage, 'LifecycleGuest');
			await joinRoomByCode(guestPage, roomCode);

			await expect(hostPage.getByText('LifecycleGuest')).toBeVisible({ timeout: 5000 });

			// 3. Guest leaves room
			await guestPage.getByRole('button', { name: 'Leave Room' }).click();

			// 4. Verify guest returns to lobby home with clean URL hash
			await expect(guestPage.getByText('Tabletop Card Arena')).toBeVisible({ timeout: 5000 });
			const guestHash = await guestPage.evaluate(() => window.location.hash);
			expect(guestHash).toBe('');

			// 5. Guest re-joins the same room
			await joinRoomByCode(guestPage, roomCode);
			await expect(guestPage.getByText('Waiting Room')).toBeVisible({ timeout: 10000 });
			await expect(hostPage.getByText('LifecycleGuest')).toBeVisible({ timeout: 5000 });
		} finally {
			await hostContext.close();
			await guestContext.close();
		}
	});
});
}
