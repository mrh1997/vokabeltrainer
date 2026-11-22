import { describe, expect, it } from 'vitest';
import { BOX_SHARES, checkAnswer, groupByWeek, isoWeek, nextBox, pickNext } from './index';

/** Small deterministic random generator so the statistics test is stable. */
function seeded(seed: number) {
	return () => {
		seed = (seed * 1664525 + 1013904223) % 4294967296;
		return seed / 4294967296;
	};
}

const cards = (boxes: number[]) =>
	boxes.flatMap((count, i) => Array.from({ length: count }, (_, j) => ({ id: `b${i + 1}-${j}`, box: i + 1 })));

describe('nextBox', () => {
	it('moves up on success and back to 1 on failure', () => {
		expect(nextBox(1, true)).toBe(2);
		expect(nextBox(5, true)).toBe(5);
		expect(nextBox(4, false)).toBe(1);
	});
});

describe('checkAnswer', () => {
	it('requires an exact match except surrounding spaces', () => {
		expect(checkAnswer('la maison', ' la maison ')).toBe(true);
		expect(checkAnswer('la maison', 'La maison')).toBe(false);
		expect(checkAnswer('le café', 'le cafe')).toBe(false);
		expect(checkAnswer('la maison', 'maison')).toBe(false);
	});
});

describe('pickNext', () => {
	it('follows the fixed box shares', () => {
		const deck = cards([10, 10, 10, 10, 10]);
		const random = seeded(42);
		const counts = [0, 0, 0, 0, 0];
		for (let i = 0; i < 20000; i++) counts[pickNext(deck, undefined, random)!.box - 1]++;
		counts.forEach((c, i) => expect(c / 20000).toBeCloseTo(BOX_SHARES[i], 1));
	});

	it('spreads the share of empty boxes proportionally', () => {
		const deck = cards([5, 0, 0, 0, 5]);
		const random = seeded(7);
		let box5 = 0;
		for (let i = 0; i < 20000; i++) if (pickNext(deck, undefined, random)!.box === 5) box5++;
		expect(box5 / 20000).toBeCloseTo(0.06 / 0.46, 1);
	});

	it('does not repeat the previous card unless it is the only one', () => {
		const deck = cards([2]);
		for (let i = 0; i < 50; i++) expect(pickNext(deck, 'b1-0')!.id).toBe('b1-1');
		expect(pickNext(cards([1]), 'b1-0')!.id).toBe('b1-0');
		expect(pickNext([], undefined)).toBeUndefined();
	});
});

describe('calendar weeks', () => {
	it('computes ISO weeks around the new year', () => {
		expect(isoWeek(new Date(2026, 0, 1))).toEqual({ year: 2026, week: 1 });
		expect(isoWeek(new Date(2027, 0, 1))).toEqual({ year: 2026, week: 53 });
		expect(isoWeek(new Date(2024, 11, 30))).toEqual({ year: 2025, week: 1 });
		expect(isoWeek(new Date(2026, 10, 22))).toEqual({ year: 2026, week: 47 });
	});

	it('groups consecutive items by week in entry order', () => {
		const items = [new Date(2026, 10, 16), new Date(2026, 10, 22), new Date(2026, 10, 23)].map((d) => ({ createdAt: d.getTime() }));
		const groups = groupByWeek(items);
		expect(groups.map((g) => [g.label, g.items.length])).toEqual([
			['KW 47 / 2026', 2],
			['KW 48 / 2026', 1]
		]);
	});
});
