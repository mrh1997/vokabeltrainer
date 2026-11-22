import { describe, expect, it } from 'vitest';
import { descriptionAddsWords, linguaLibreSpeaker, recordingSays, spokenWords } from './recordings';

describe('recordingSays', () => {
	it('matches recordings of exactly the answer', () => {
		expect(recordingSays('Fr-chien.ogg', 'chien')).toBe(true);
		expect(recordingSays('En-uk-to go.ogg', 'to go')).toBe(true);
		expect(recordingSays('LL-Q150 (fra)-Yug-la_maison.wav', 'la maison')).toBe(true);
	});

	it('rejects recordings of only part of the answer', () => {
		expect(recordingSays('En-us-dog.ogg', 'a dog')).toBe(false);
		expect(recordingSays('En-us-go.ogg', 'to go')).toBe(false);
		expect(recordingSays('Fr-une maison-fr-ouest.ogg', 'la maison')).toBe(false);
		expect(recordingSays('Fr-chien.ogg', 'le chien')).toBe(false);
	});
});

describe('recordingSays with bare words', () => {
	it('rejects recordings that say more than the word', () => {
		expect(recordingSays('Fr-une bête.ogg', 'bête')).toBe(false);
		expect(recordingSays('De-aller2.ogg', 'aller')).toBe(false);
	});

	it('accepts recordings with region or speaker parts', () => {
		expect(recordingSays('En-us-inlandnorth-gut.ogg', 'gut')).toBe(true);
		expect(recordingSays('LL-Q150 (fra)-Yug-aller.wav', 'aller')).toBe(true);
	});
});

describe('recordingSays with hyphenated words', () => {
	it('matches a hyphenated text at the end of the name', () => {
		expect(recordingSays('LL-Q150 (fra)-Yug-peut-être.wav', 'peut-être')).toBe(true);
		expect(recordingSays('LL-Q150 (fra)-Yug-peut-être.wav', 'être')).toBe(true);
		expect(recordingSays('Fr-peut-être.ogg', 'peut')).toBe(true); // ambiguous name, accepted as before
	});
});

describe('linguaLibreSpeaker', () => {
	it('reads the speaker of a Lingua Libre recording', () => {
		expect(linguaLibreSpeaker('LL-Q150 (fra)-WikiLucas00-chien.wav', 'chien')).toBe('wikilucas00');
		expect(linguaLibreSpeaker('LL-Q150 (fra)-val (Eavq)-je.wav', 'je')).toBe('val (eavq)');
		expect(linguaLibreSpeaker('LL-Q150 (fra)-Aurore1212121-La table.wav', 'la table')).toBe('aurore1212121');
	});

	it('ignores other recordings and other words', () => {
		expect(linguaLibreSpeaker('Fr-chien.ogg', 'chien')).toBeUndefined();
		expect(linguaLibreSpeaker('LL-Q150 (fra)-Julien Baley-un chien.wav', 'chien')).toBeUndefined();
	});
});

describe('spokenWords', () => {
	it('splits an answer into the words to record', () => {
		expect(spokenWords('le chien')).toEqual(['le', 'chien']);
		expect(spokenWords("l'arbre")).toEqual(["l'arbre"]);
		expect(spokenWords('¿qué tal?')).toEqual(['qué', 'tal']);
	});
});

describe('descriptionAddsWords', () => {
	it('spots descriptions revealing a longer phrase', () => {
		expect(descriptionAddsWords('Pronunciation of "chien" (un chien) in French. Male voice.', 'chien')).toBe(true);
		expect(descriptionAddsWords('Pronunciation of word "le" in French. Male voice.', 'le')).toBe(false);
		expect(descriptionAddsWords('Pronunciation of "chien" (France)', 'chien')).toBe(false);
		expect(descriptionAddsWords('Pronunciation of "chien" (chien)', 'chien')).toBe(false);
	});
});
