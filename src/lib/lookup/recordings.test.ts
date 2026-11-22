import { describe, expect, it } from 'vitest';
import { recordingSays } from './recordings';

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
