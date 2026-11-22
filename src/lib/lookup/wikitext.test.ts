import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseForeignEntry, parseTranslations } from './wikitext';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}.wikitext`, import.meta.url), 'utf-8');

describe('parseTranslations', () => {
	it('finds French translations of Haus with gender and meaning', () => {
		const t = parseTranslations(fixture('Haus'), 'fr');
		expect(t[0]).toMatchObject({ word: 'maison', gender: 'f', pos: 'noun' });
		expect(t[0].meaning).toBeTruthy();
		expect(t.map((x) => x.word)).toContain('chambre');
		expect(new Set(t.map((x) => x.word)).size).toBe(t.length);
	});

	it('handles language variants and transliterations', () => {
		const el = parseTranslations(fixture('Haus'), 'el');
		expect(el[0]).toMatchObject({ word: 'οίκος', translit: 'íkos', gender: 'm' });
	});

	it('finds verb translations of gehen', () => {
		const fr = parseTranslations(fixture('gehen'), 'fr');
		expect(fr[0]).toMatchObject({ word: 'aller', pos: 'verb' });
		const en = parseTranslations(fixture('gehen'), 'en').map((x) => x.word);
		expect(en.slice(0, 2)).toEqual(['walk', 'go']);
		expect(en).toContain('be operable');
	});

	it('ignores other languages', () => {
		expect(parseTranslations(fixture('Haus'), 'xx')).toEqual([]);
	});
});

describe('parseForeignEntry', () => {
	it('reads gender, audio and plural of a French noun', () => {
		const e = parseForeignEntry(fixture('chien'), 'Französisch', 'chien', 'noun')!;
		expect(e).toMatchObject({ pos: 'noun', gender: 'm', audioFiles: ['Fr-chien.ogg'] });
		expect(e.forms).toEqual([{ key: 'Plural', value: 'chiens' }]);
	});

	it('picks the requested word type and reads verb forms + auxiliary', () => {
		const e = parseForeignEntry(fixture('aller'), 'Französisch', 'aller', 'verb')!;
		expect(e.pos).toBe('verb');
		expect(e.auxiliary).toBe('être');
		expect(e.forms).toContainEqual({ key: 'Präsens 3. Person Singular', value: 'va' });
		expect(e.forms).toContainEqual({ key: 'Partizip II', value: 'allé' });
		const noun = parseForeignEntry(fixture('aller'), 'Französisch', 'aller', 'noun')!;
		expect(noun.gender).toBe('m');
		expect(noun.audioFiles).toEqual(['Fr-aller.ogg']);
	});

	it('reads English verb forms', () => {
		const e = parseForeignEntry(fixture('go'), 'Englisch', 'go', 'verb')!;
		expect(e.forms.map((f) => f.value)).toEqual(['goes', 'went', 'going', 'gone']);
		expect(e.audioFiles.length).toBeGreaterThan(0);
	});

	it('reads French adjective forms', () => {
		const e = parseForeignEntry(fixture('beau'), 'Französisch', 'beau', 'adj')!;
		expect(e.forms.map((f) => f.value)).toEqual(['beau / bel', 'belle', 'beaux', 'belles']);
	});

	it('returns null when the language is missing', () => {
		expect(parseForeignEntry(fixture('chien'), 'Englisch', 'chien', 'noun')).toBeNull();
	});
});
