import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

const FIXTURES = 'src/lib/lookup/fixtures';

/** Replays Wikimedia API answers from the unit-test fixtures (no network needed). */
async function mockWikimedia(page: Page) {
	await page.route('https://de.wiktionary.org/**', async (route) => {
		const p = new URL(route.request().url()).searchParams;
		if (p.get('action') === 'opensearch') {
			const q = p.get('search') ?? '';
			const words = ['gehen', 'Haus', 'Hund', 'gut', 'schön'].filter((w) => w.toLowerCase().startsWith(q.toLowerCase()));
			return route.fulfill({ json: [q, words, [], []] });
		}
		const file = `${FIXTURES}/${p.get('page')}.wikitext`;
		if (existsSync(file)) {
			return route.fulfill({ json: { parse: { title: p.get('page'), wikitext: readFileSync(file, 'utf-8') } } });
		}
		return route.fulfill({ json: { error: { code: 'missingtitle' } } });
	});
	await page.route('https://commons.wikimedia.org/**', (route) => {
		const p = new URL(route.request().url()).searchParams;
		if (p.get('prop') === 'videoinfo') {
			return route.fulfill({
				json: {
					query: {
						pages: [{ videoinfo: [{ url: 'x', derivatives: [{ type: 'audio/mpeg', src: 'https://upload.wikimedia.org/test.mp3' }] }] }]
					}
				}
			});
		}
		return route.fulfill({ json: { query: { search: [] } } });
	});
	await page.route('https://upload.wikimedia.org/**', (route) => route.fulfill({ body: Buffer.from('ID3'), contentType: 'audio/mpeg' }));
}

test.beforeEach(async ({ page }) => {
	await mockWikimedia(page);
});

test('add a word with forms, quiz it, delete it', async ({ page }) => {
	await page.goto('./');
	await expect(page.getByRole('heading', { name: 'Welche Sprache möchtest du lernen?' })).toBeVisible();
	await page.getByRole('button', { name: 'Französisch' }).click();
	await expect(page).toHaveURL(/\/vokabeltrainer\/fr$/);

	await page.getByRole('link', { name: /Vokabeln hinzufügen/ }).click();
	await expect(page).toHaveURL(/\/fr\/hinzufuegen$/);

	// Step 1: German word + Enter
	const german = page.getByLabel('Deutsch (ohne Artikel)');
	await german.fill('gehen');
	await german.press('Enter');

	// Step 2: translation list, first entry highlighted
	const foreign = page.getByRole('combobox', { name: 'Französisch' });
	await expect(foreign).toBeFocused();
	await expect(page.getByRole('option', { name: /aller/ }).first()).toBeVisible();
	await foreign.press('Enter');

	// Step 3: tick two special forms (keyboard + click)
	const forms = page.getByRole('listbox', { name: /Sonderformen von „aller“/ });
	await expect(forms).toBeFocused();
	await forms.press('ArrowDown'); // tu vas
	await forms.press('ArrowDown'); // il va
	await forms.press(' ');
	await page.getByRole('option', { name: /il est allé/ }).click();
	await forms.press('Enter');

	await expect(page.locator('.status')).toContainText('„gehen“ → „aller“ hinzugefügt (+2 Formen)');
	await expect(german).toBeFocused();
	const week = page.locator('section.week');
	await expect(week.locator('.row')).toHaveCount(3);
	await expect(week.locator('.answer')).toHaveText(['aller', 'il va', 'il est allé']);
	await expect(week.locator('.form-label')).toHaveText(['er geht', 'er ist gegangen']);

	// cards from older app versions (no German prompt stored) are upgraded automatically
	await page.evaluate(
		() =>
			new Promise<void>((resolve) => {
				const open = indexedDB.open('vokabeltrainer');
				open.onsuccess = () => {
					const store = open.result.transaction('cards', 'readwrite').objectStore('cards');
					store.getAll().onsuccess = (e) => {
						for (const c of (e.target as IDBRequest).result) {
							delete c.prompt;
							store.put(c);
						}
						store.transaction.oncomplete = () => resolve();
					};
				};
			})
	);
	await page.reload();
	await expect(week.locator('.form-label')).toHaveText(['er geht', 'er ist gegangen']);
	await expect(week.locator('.badge')).toHaveText(['1', '1', '1']);
	await expect(week.locator('h3')).toContainText(/KW \d+ \/ \d{4}/);

	// Quiz: answer every card correctly once → box 2
	await page.goto('./fr/abfragen');
	const answerInput = page.getByLabel('Übersetzung auf Französisch');
	for (let i = 0; i < 3; i++) {
		// special forms are asked by their German counterpart
		await expect(page.locator('.prompt')).toHaveText(/^(gehen|er geht|er ist gegangen)$/);
		const prompt = await page.locator('.prompt').textContent();
		const expected = { gehen: 'aller', 'er geht': 'il va', 'er ist gegangen': 'il est allé' }[prompt!]!;
		await answerInput.fill(expected);
		await answerInput.press('Enter');
		await expect(page.getByText('✓ Richtig!')).toBeVisible();
		await page.keyboard.press('Enter');
	}
	// A wrong answer shows the solution and resets to box 1
	await answerInput.fill('falsch');
	await answerInput.press('Enter');
	await expect(page.getByText('✗ Leider falsch')).toBeVisible();
	await expect(page.locator('.solution')).not.toBeEmpty();
	await expect(page.locator('.move .badge')).toHaveText('1');
	await expect(page.getByText('Diese Runde: 3 von 4 richtig')).toBeVisible();

	// Back to the list: 4 answers recorded in total, boxes moved
	await page.goBack();
	await expect(page).toHaveURL(/\/fr\/hinzufuegen$/);
	await expect(week.locator('.asked')).toHaveCount(3);
	await expect
		.poll(async () => (await week.locator('.asked').allTextContents()).reduce((n, t) => n + parseInt(t), 0))
		.toBe(4);
	await expect(week.locator('.badge').filter({ hasNotText: '1' })).not.toHaveCount(0);

	// Delete the main word (and its forms)
	await page.getByRole('button', { name: 'aller löschen' }).click();
	await expect(page.getByRole('alertdialog')).toContainText('„aller“ und 2 Sonderform(en) löschen?');
	await page.getByRole('alertdialog').getByRole('button', { name: 'Abbrechen' }).click();
	await expect(page.locator('section.week .row')).toHaveCount(3);
	await page.getByRole('button', { name: 'aller löschen' }).click();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Löschen' }).click();
	await expect(page.locator('section.week')).toHaveCount(0);
});

test('deep links, reload and back button work', async ({ page }) => {
	await page.goto('./en/hinzufuegen');
	await expect(page.getByRole('heading', { name: 'Vokabeln hinzufügen' })).toBeVisible();
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Vokabeln hinzufügen' })).toBeVisible();
	await page.getByRole('link', { name: 'Zurück' }).click();
	await expect(page).toHaveURL(/\/vokabeltrainer\/en$/);
	await page.getByRole('link', { name: 'Impressum & Datenschutz' }).click();
	await expect(page.getByText('ausschließlich lokal in diesem Browser')).toBeVisible();
	await page.goBack();
	await expect(page).toHaveURL(/\/vokabeltrainer\/en$/);
	await page.goto('./xx');
	await expect(page.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible();
});

test('English nouns get a/an and the quiz works offline', async ({ page, context }) => {
	await page.goto('./en/hinzufuegen');
	const german = page.getByLabel('Deutsch (ohne Artikel)');
	await german.fill('Hund');
	await german.press('Enter');
	const foreign = page.getByRole('combobox', { name: 'Englisch' });
	await expect(page.getByRole('option', { name: /^dog/ }).first()).toBeVisible();
	await foreign.fill('dog');
	await foreign.press('Enter');
	await expect(page.locator('.status')).toContainText('„Hund“ → „a dog“ hinzugefügt');

	// a second word appears at the top: newest first
	await german.fill('Haus');
	await german.press('Enter');
	await expect(page.getByRole('option', { name: /^house/ }).first()).toBeVisible();
	await foreign.press('Enter');
	await expect(page.locator('.status')).toContainText('„Haus“ → „a house“ hinzugefügt');
	await expect(page.locator('section.week .answer')).toHaveText(['a house', 'a dog']);

	await page.evaluate(() => navigator.serviceWorker.ready);
	// Go offline. Playwright's offline switch does not cover service-worker
	// requests, so additionally make every request to the site fail.
	await context.setOffline(true);
	await context.route('http://localhost:4173/**', (route) => route.abort('internetdisconnected'));
	await page.goto('./en/abfragen');
	await expect(page.locator('.prompt')).toHaveText(/^(Hund|Haus)$/);
	const prompt = await page.locator('.prompt').textContent();
	const answer = page.getByLabel('Übersetzung auf Englisch');
	await answer.fill(prompt === 'Hund' ? 'a dog' : 'a house');
	await answer.press('Enter');
	await expect(page.getByText('✓ Richtig!')).toBeVisible();
	await expect(page.getByText('offline', { exact: true })).toBeVisible();
	await context.unrouteAll();
	await context.setOffline(false);
});
