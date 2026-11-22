import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildFormCandidates, buildMainAnswer } from './answers';
import { parseForeignEntry, type Pos } from './wikitext';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}.wikitext`, import.meta.url), 'utf-8');

describe('buildMainAnswer', () => {
	it('adds French articles incl. elision', () => {
		expect(buildMainAnswer('fr', 'maison', 'noun', 'f')).toBe('la maison');
		expect(buildMainAnswer('fr', 'chien', 'noun', 'm')).toBe('le chien');
		expect(buildMainAnswer('fr', 'arbre', 'noun', 'm')).toBe("l'arbre");
		expect(buildMainAnswer('fr', 'heure', 'noun', 'f')).toBe("l'heure");
		expect(buildMainAnswer('fr', 'héros', 'noun', 'm')).toBe('le héros');
		expect(buildMainAnswer('fr', 'aller', 'verb')).toBe('aller');
	});

	it('adds English a/an and to', () => {
		expect(buildMainAnswer('en', 'house', 'noun')).toBe('a house');
		expect(buildMainAnswer('en', 'apple', 'noun')).toBe('an apple');
		expect(buildMainAnswer('en', 'hour', 'noun')).toBe('an hour');
		expect(buildMainAnswer('en', 'university', 'noun')).toBe('a university');
		expect(buildMainAnswer('en', 'go', 'verb')).toBe('to go');
		expect(buildMainAnswer('en', 'good', 'adj')).toBe('good');
	});

	it('handles other article languages and falls back to the bare word', () => {
		expect(buildMainAnswer('es', 'casa', 'noun', 'f')).toBe('la casa');
		expect(buildMainAnswer('it', 'casa', 'noun', 'f')).toBe('la casa');
		expect(buildMainAnswer('it', 'studente', 'noun', 'm')).toBe('lo studente');
		expect(buildMainAnswer('it', 'amico', 'noun', 'm')).toBe("l'amico");
		expect(buildMainAnswer('nl', 'huis', 'noun', 'n')).toBe('het huis');
		expect(buildMainAnswer('sv', 'hus', 'noun', 'n')).toBe('hus');
		expect(buildMainAnswer('fr', 'chose', 'noun')).toBe('chose');
	});
});

describe('buildFormCandidates', () => {
	it('builds French verb forms with pronouns and passé composé', () => {
		const entry = parseForeignEntry(fixture('aller'), 'Französisch', 'aller', 'verb')!;
		const forms = buildFormCandidates('fr', 'aller', entry);
		expect(forms).toContainEqual({ label: 'Präsens: ich', answer: 'je vais' });
		expect(forms).toContainEqual({ label: 'Präsens: er/sie/es', answer: 'il va' });
		expect(forms).toContainEqual({ label: 'Präsens: sie (Plural)', answer: 'ils vont' });
		expect(forms).toContainEqual({ label: 'Passé composé: er/sie/es', answer: 'il est allé' });
		expect(forms.some((f) => f.label === 'Hilfsverb')).toBe(false);
	});

	it('offers only irregular English verb forms', () => {
		const entry = parseForeignEntry(fixture('go'), 'Englisch', 'go', 'verb')!;
		expect(buildFormCandidates('en', 'go', entry)).toEqual([
			{ label: 'Vergangenheit', answer: 'went' },
			{ label: 'Partizip Perfekt', answer: 'gone' }
		]);
	});

	const forms = (name: string, lang: string, langName: string, word: string, pos: Pos) =>
		buildFormCandidates(lang, word, parseForeignEntry(fixture(name), langName, word, pos)!).map((f) => f.answer);

	it('leaves out standard forms', () => {
		expect(forms('roof', 'en', 'Englisch', 'roof', 'noun')).toEqual([]);
		expect(forms('walk', 'en', 'Englisch', 'walk', 'verb')).toEqual([]);
		expect(forms('stop', 'en', 'Englisch', 'stop', 'verb')).toEqual([]);
		expect(forms('big', 'en', 'Englisch', 'big', 'adj')).toEqual([]);
		expect(forms('chien', 'fr', 'Französisch', 'chien', 'noun')).toEqual([]);
		expect(forms('parler', 'fr', 'Französisch', 'parler', 'verb')).toEqual([]);
		expect(forms('manger', 'fr', 'Französisch', 'manger', 'verb')).toEqual([]);
		expect(forms('finir', 'fr', 'Französisch', 'finir', 'verb')).toEqual([]);
		expect(forms('hablar', 'es', 'Spanisch', 'hablar', 'verb')).toEqual([]);
		expect(forms('casa', 'es', 'Spanisch', 'casa', 'noun')).toEqual([]);
		expect(forms('parlare', 'it', 'Italienisch', 'parlare', 'verb')).toEqual([]);
		expect(forms('casa', 'it', 'Italienisch', 'casa', 'noun')).toEqual([]);
	});

	it('keeps irregular forms', () => {
		expect(forms('child', 'en', 'Englisch', 'child', 'noun')).toEqual(['children']);
		expect(forms('gut', 'en', 'Englisch', 'gut', 'noun')).toEqual([]);
		expect(forms('cheval', 'fr', 'Französisch', 'cheval', 'noun')).toEqual(['les chevaux']);
		expect(forms('aller', 'fr', 'Französisch', 'aller', 'verb')).toEqual([
			'je vais',
			'tu vas',
			'il va',
			'ils vont',
			'il est allé'
		]);
		expect(forms('beau', 'fr', 'Französisch', 'beau', 'adj')).toEqual(['belle', 'beaux']);
	});
});
