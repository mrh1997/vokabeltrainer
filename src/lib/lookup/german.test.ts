import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildFormCandidates } from './answers';
import { overviewParams, parseForeignEntry, type Pos } from './wikitext';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}.wikitext`, import.meta.url), 'utf-8');

/** Special forms of a foreign word as "German prompt → answer". */
function pairs(foreign: string, langName: string, lang: string, german: string, pos: Pos) {
	const entry = parseForeignEntry(fixture(foreign), langName, foreign, pos)!;
	const table = overviewParams(fixture(german), 'Deutsch', pos);
	return buildFormCandidates(lang, foreign, entry, { word: german, table }).map((f) => `${f.prompt ?? '?'} → ${f.answer}`);
}

describe('German prompts for special forms', () => {
	it('French verb forms', () => {
		expect(pairs('aller', 'Französisch', 'fr', 'gehen', 'verb')).toEqual([
			'ich gehe → je vais',
			'du gehst → tu vas',
			'er geht → il va',
			'sie gehen → ils vont',
			'er ist gegangen → il est allé'
		]);
	});

	it('English verb, noun and adjective forms', () => {
		expect(pairs('go', 'Englisch', 'en', 'gehen', 'verb')).toEqual(['ich ging → went', 'gegangen → gone']);
		expect(pairs('child', 'Englisch', 'en', 'Kind', 'noun')).toEqual(['die Kinder → children']);
		expect(pairs('good', 'Englisch', 'en', 'gut', 'adj')).toEqual(['besser → better', 'am besten → best']);
	});

	it('French adjective forms', () => {
		expect(pairs('beau', 'Französisch', 'fr', 'schön', 'adj')).toEqual(['schön (weiblich) → belle', 'schön (männlich Plural) → beaux']);
	});

	it('leaves the prompt empty when the German table is missing', () => {
		const entry = parseForeignEntry(fixture('aller'), 'Französisch', 'aller', 'verb')!;
		const forms = buildFormCandidates('fr', 'aller', entry, { word: 'gehen', table: new Map() });
		expect(forms.find((f) => f.answer === 'je vais')).toEqual({ label: 'Präsens: ich', answer: 'je vais' });
	});
});
