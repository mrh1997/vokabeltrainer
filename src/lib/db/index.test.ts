import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import { addWord, deleteCard, getAudio, listCards, listLanguages, recordAnswer, setForms } from './index';

describe('card store', () => {
	it('stores a word with its chosen forms, progress and audio', async () => {
		const { main } = await addWord({
			lang: 'en',
			german: 'gehen',
			answer: 'to go',
			audio: { id: 'En-us-go.ogg', blob: new Blob(['x'], { type: 'audio/mpeg' }) },
			forms: [
				{ label: 'Vergangenheit', answer: 'went' },
				{ label: 'Partizip Perfekt', answer: 'gone' }
			]
		});
		let cards = await listCards('en');
		expect(cards.map((c) => c.answer)).toEqual(['to go', 'went', 'gone']);
		expect(cards.every((c) => c.box === 1 && c.asked === 0)).toBe(true);
		expect((await listLanguages()).map((l) => l.code)).toEqual(['en']);
		expect(await getAudio('En-us-go.ogg')).toBeTruthy();

		const went = cards[1];
		const after = await recordAnswer(await recordAnswer(went, true), true);
		expect(after).toMatchObject({ box: 3, asked: 2, correct: 2 });
		expect((await recordAnswer(after, false)).box).toBe(1);

		await setForms(main, [
			{ label: 'Vergangenheit', answer: 'went' },
			{ label: 'Präsens: er/sie/es', answer: 'goes' }
		]);
		cards = await listCards('en');
		expect(cards.map((c) => c.answer).sort()).toEqual(['goes', 'to go', 'went']);
		expect(cards.find((c) => c.answer === 'went')!.asked).toBe(3);

		await deleteCard(main);
		expect(await listCards('en')).toEqual([]);
		expect(await getAudio('En-us-go.ogg')).toBeUndefined();
	});

	it('does not add an existing word again but refreshes it and merges its forms', async () => {
		const word = { lang: 'fr', german: 'gehen', answer: 'aller' };
		const first = await addWord({
			...word,
			forms: [
				{ label: 'er geht', answer: 'il va' },
				{ label: 'sie gehen', answer: 'ils vont' }
			]
		});
		expect(first.existed).toBe(false);
		// progress: main card and both forms move up
		for (const c of await listCards('fr')) await recordAnswer(await recordAnswer(c, true), true);
		const before = await listCards('fr');
		expect(before.every((c) => c.box === 3)).toBe(true);

		await new Promise((r) => setTimeout(r, 5));
		const again = await addWord({
			...word,
			forms: [
				{ label: 'ich gehe', answer: 'je vais' },
				{ label: 'er geht', answer: 'il va' }
			]
		});
		expect(again.existed).toBe(true);
		expect(again.main.id).toBe(first.main.id);

		const cards = await listCards('fr');
		const box = (answer: string) => cards.find((c) => c.answer === answer)!.box;
		expect(cards.map((c) => c.answer)).toEqual(['aller', 'je vais', 'il va', 'ils vont']);
		expect(box('aller')).toBe(1); // existing word: back to box 1
		expect(box('je vais')).toBe(1); // new form
		expect(box('il va')).toBe(1); // existing and chosen again
		expect(box('ils vont')).toBe(3); // existing, not chosen: keeps its box
		// moved to the front: newer than when first added, forms listed with it
		expect(cards.every((c) => c.createdAt === again.main.createdAt)).toBe(true);
		expect(again.main.createdAt).toBeGreaterThan(before[0].createdAt);
		// progress statistics stay
		expect(cards.find((c) => c.answer === 'ils vont')!.asked).toBe(2);

		await deleteCard(again.main);
	});

	it('treats the same answer for another German word as a separate word', async () => {
		await addWord({ lang: 'fr', german: 'Hund', answer: 'le chien', forms: [] });
		const other = await addWord({ lang: 'fr', german: 'Köter', answer: 'le chien', forms: [] });
		expect(other.existed).toBe(false);
		expect((await listCards('fr')).length).toBe(2);
	});

	it('merges copies of a word saved twice by earlier versions', async () => {
		const first = await addWord({ lang: 'es', german: 'gehen', answer: 'ir', forms: [{ label: 'ich gehe', answer: 'voy' }] });
		await recordAnswer(first.main, true);
		// an earlier version stored the same word a second time
		const raw = await openDB('vokabeltrainer');
		const copy = { ...first.main, id: 'copy', createdAt: first.main.createdAt + 1, box: 4, asked: 3, correct: 3 };
		await raw.put('cards', copy);
		await raw.put('cards', { ...copy, id: 'copy-voy', parentId: 'copy', formLabel: 'ich gehe', answer: 'voy', asked: 5, box: 5 });
		await raw.put('cards', { ...copy, id: 'copy-va', parentId: 'copy', formLabel: 'er geht', answer: 'va', asked: 1, box: 2, order: 1 });
		raw.close();

		const again = await addWord({ lang: 'es', german: 'gehen', answer: 'ir', forms: [{ label: 'du gehst', answer: 'vas' }] });
		const cards = await listCards('es');
		expect(cards.filter((c) => !c.parentId)).toHaveLength(1);
		expect(cards.map((c) => c.answer)).toEqual(['ir', 'vas', 'voy', 'va']);
		expect(cards.filter((c) => c.parentId).every((c) => c.parentId === again.main.id)).toBe(true);
		expect(again.main).toMatchObject({ box: 1, asked: 4, correct: 4 });
		// "voy" was in both copies: the more practised one stays, with its box
		expect(cards.find((c) => c.answer === 'voy')).toMatchObject({ asked: 5, box: 5 });
		expect(cards.find((c) => c.answer === 'va')!.box).toBe(2);
	});
});
