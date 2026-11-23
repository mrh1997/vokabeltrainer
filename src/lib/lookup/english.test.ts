import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildMainAnswer } from './answers';
import { withoutArticle } from './english';
import { germanNounIsPerson, parseForeignEntry } from './wikitext';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}.wikitext`, import.meta.url), 'utf-8');

/** The English answer as looked up: word page and German page from the fixtures. */
function answer(word: string, german?: string) {
	const entry = parseForeignEntry(fixture(word), 'Englisch', word, 'noun')!;
	const person = !!german && germanNounIsPerson(fixture(german));
	return buildMainAnswer('en', word, 'noun', undefined, { number: entry.number, person });
}

describe('English nouns without a/an', () => {
	it('keeps a/an for countable nouns', () => {
		expect(answer('house', 'Haus')).toBe('a house');
		expect(answer('child', 'Kind')).toBe('a child');
		expect(answer('mouse', 'Maus')).toBe('a mouse');
		for (const w of ['dog', 'T-shirt', 'CD', 'Christmas tree', 'glass of water', 'piece of furniture', 'pair of scissors', 'mother-in-law'])
			expect([w, withoutArticle(w)]).toEqual([w, false]);
	});

	it('leaves it out for names', () => {
		expect(answer('Monday', 'Montag')).toBe('Monday');
		for (const w of ['January', 'Germany', 'New York', 'Christmas', 'USA', 'the Netherlands', 'United States of America', 'monday'])
			expect([w, withoutArticle(w)]).toEqual([w, true]);
	});

	it('tells people from languages by the German word', () => {
		expect(answer('Italian', 'Italiener')).toBe('an Italian');
		expect(answer('Italian', 'Italienisch')).toBe('Italian');
	});

	it('leaves it out for uncountable nouns and plurals', () => {
		for (const w of ['information', 'furniture', 'advice', 'scissors', 'glasses', 'parents']) expect(answer(w)).toBe(w);
		for (const w of ['mineral water', 'jeans', 'homework']) expect([w, withoutArticle(w)]).toEqual([w, true]);
	});
});
