import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	timeout: 30000,
	use: { baseURL: 'http://localhost:4173/vokabeltrainer/', locale: 'de-DE' },
	projects: [
		{ name: 'desktop', use: { ...devices['Desktop Chrome'] } },
		{ name: 'phone', use: { ...devices['Pixel 7'] } }
	],
	webServer: {
		command: 'npm run build && npx vite preview --port 4173 --strictPort',
		url: 'http://localhost:4173/vokabeltrainer/',
		reuseExistingServer: !process.env.CI,
		timeout: 120000
	}
});
