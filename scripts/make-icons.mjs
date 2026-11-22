// Renders static/favicon.svg to the PNG icons used by the web app manifest.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const svg = readFileSync('static/favicon.svg', 'utf-8');
const browser = await chromium.launch();
for (const size of [192, 512]) {
	const page = await browser.newPage({ viewport: { width: size, height: size } });
	await page.setContent(`<style>*{margin:0}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`);
	await page.screenshot({ path: `static/icon-${size}.png`, omitBackground: true });
}
await browser.close();
