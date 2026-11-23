import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildFormCandidates } from './answers';
import { germanMainPrompt } from './german';
import { germanNounGender, overviewParams, parseForeignEntry, type Pos } from './wikitext';

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
		expect(pairs('child', 'Englisch', 'en', 'Kind', 'noun')).toEqual(['Kinder → children']);
		expect(pairs('good', 'Englisch', 'en', 'gut', 'adj')).toEqual(['besser → better', 'am besten → best']);
	});

	it('numbered plurals and the article only where the answer has one', () => {
		expect(pairs('mouse', 'Englisch', 'en', 'Maus', 'noun')).toEqual(['Mäuse → mice']);
		expect(pairs('cheval', 'Französisch', 'fr', 'Pferd', 'noun')).toEqual(['die Pferde → les chevaux']);
	});

	it('Italian verb tables offer no stem or ending', () => {
		expect(pairs('mangiare', 'Italienisch', 'it', 'essen', 'verb')).toEqual(['du isst → mangi', 'wir essen → mangiamo', 'iss! → mangi']);
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

describe('German prompt of main noun cards', () => {
	const gender = (word: string) => germanNounGender(fixture(word));

	it('reads the gender of German nouns', () => {
		expect([gender('Hund'), gender('Uhr'), gender('Haus'), gender('Kind')]).toEqual(['m', 'f', 'n', 'n']);
		expect(gender('gehen')).toBeUndefined();
	});

	it('uses the definite article, or the indefinite one for English', () => {
		expect(germanMainPrompt('fr', 'Hund', 'noun', 'chien', 'le chien', 'm')).toBe('der Hund');
		expect(germanMainPrompt('fr', 'Uhr', 'noun', 'heure', "l'heure", 'f')).toBe('die Uhr');
		expect(germanMainPrompt('es', 'Haus', 'noun', 'casa', 'la casa', 'n')).toBe('das Haus');
		expect(germanMainPrompt('en', 'Hund', 'noun', 'dog', 'a dog', 'm')).toBe('ein Hund');
		expect(germanMainPrompt('en', 'Uhr', 'noun', 'clock', 'a clock', 'f')).toBe('eine Uhr');
	});

	it('adds no article when the answer has none or the gender is unknown', () => {
		expect(germanMainPrompt('sv', 'Hund', 'noun', 'hund', 'hund', 'm')).toBeUndefined();
		expect(germanMainPrompt('fr', 'Hund', 'noun', 'chien', 'le chien', undefined)).toBeUndefined();
		expect(germanMainPrompt('en', 'gehen', 'verb', 'go', 'to go', undefined)).toBeUndefined();
	});
});
