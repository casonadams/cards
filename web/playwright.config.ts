import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	timeout: 60000,
	expect: {
		timeout: 10000
	},
	fullyParallel: false,
	workers: 1,
	reporter: [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL: 'http://localhost:4173',
		headless: true,
		trace: 'on-first-retry',
		video: 'off',
		launchOptions: {
			executablePath:
				process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
				'/home/tyson/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--disable-dev-shm-usage',
				'--disable-gpu'
			]
		}
	},
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome']
			}
		}
	],
	webServer: {
		command: 'pnpm preview',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		timeout: 30000
	}
});
