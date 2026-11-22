import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { addWord, deleteCard, getAudio, listCards, listLanguages, recordAnswer, setForms } from './index';

describe('card store', () => {
	it('stores a word with its chosen forms, progress and audio', async () => {
		const main = await addWord({
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
});
