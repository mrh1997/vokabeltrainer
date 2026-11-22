// Downloads German Wiktionary wikitext used as unit-test fixtures.
// Usage: node scripts/fetch-fixtures.mjs Haus gehen maison …
import { writeFileSync } from 'node:fs';
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const dir = 'src/lib/lookup/fixtures';
for (const page of process.argv.slice(2)) {
	for (let attempt = 0; attempt < 5; attempt++) {
		const url = 'https://de.wiktionary.org/w/api.php?' + new URLSearchParams({
			action: 'parse', prop: 'wikitext', format: 'json', formatversion: '2', origin: '*', page
		});
		const res = await fetch(url, { headers: { 'User-Agent': 'Vokabeltrainer-fixtures/0.1 (vocabulary trainer)' } });
		const text = await res.text();
		if (text.startsWith('{')) {
			const data = JSON.parse(text);
			const name = page.replace(/[^\p{L}\p{N}_-]/gu, '_');
			writeFileSync(`${dir}/${name}.wikitext`, data.parse ? data.parse.wikitext : '');
			console.log(page, data.parse ? data.parse.wikitext.length : 'missing');
			break;
		}
		console.log(page, 'rate limited, waiting');
		await sleep(10000 * (attempt + 1));
	}
	await sleep(2000);
}
