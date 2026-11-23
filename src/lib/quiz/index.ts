/**
 * Learning rules: the 5-box system, the random choice with fixed box shares,
 * the exact answer check and grouping by calendar week.
 */

export const BOX_COUNT = 5;

/** Share of questions taken from each box (box 1 … box 5). */
export const BOX_SHARES = [0.4, 0.25, 0.17, 0.12, 0.06];

export interface Boxed {
	id: string;
	box: number;
}

/** Quizzing is only possible while box 1 holds at least one card; once it is empty, the round ends. */
export function canQuiz(cards: Boxed[]): boolean {
	return cards.some((c) => c.box <= 1);
}

/** Right answer: one box up (max 5). Wrong answer: back to box 1. */
export function nextBox(box: number, correct: boolean): number {
	return correct ? Math.min(BOX_COUNT, box + 1) : 1;
}

/** Exact comparison; only leading and trailing spaces are ignored. */
export function checkAnswer(expected: string, given: string): boolean {
	return expected.trim() === given.trim();
}

/**
 * Picks the next card: first a box by its fixed share (empty boxes are
 * skipped, their share spread proportionally over the others), then a random
 * card from that box. The previous card is avoided unless it is the only one.
 */
export function pickNext<T extends Boxed>(cards: T[], previousId?: string, random: () => number = Math.random): T | undefined {
	const pool = cards.length > 1 ? cards.filter((c) => c.id !== previousId) : cards;
	if (pool.length === 0) return undefined;
	const byBox: T[][] = Array.from({ length: BOX_COUNT }, () => []);
	for (const c of pool) byBox[Math.min(BOX_COUNT, Math.max(1, c.box)) - 1].push(c);

	const total = BOX_SHARES.reduce((sum, share, i) => sum + (byBox[i].length ? share : 0), 0);
	let r = random() * total;
	for (let i = 0; i < BOX_COUNT; i++) {
		if (!byBox[i].length) continue;
		r -= BOX_SHARES[i];
		if (r < 0 || i === BOX_COUNT - 1) return byBox[i][Math.floor(random() * byBox[i].length)];
	}
	// Floating point leftovers: take the last non-empty box.
	const last = byBox.findLast((b) => b.length)!;
	return last[Math.floor(random() * last.length)];
}

/** ISO 8601 calendar week ("KW") of a date. */
export function isoWeek(date: Date): { year: number; week: number } {
	const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
	const day = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - day); // Thursday of this week decides the year
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
	return { year: d.getUTCFullYear(), week };
}

export interface WeekGroup<T> {
	key: string;
	label: string;
	items: T[];
}

/** Groups items (sorted by entry time, either direction) into calendar weeks, keeping the order. */
export function groupByWeek<T extends { createdAt: number }>(items: T[]): WeekGroup<T>[] {
	const groups: WeekGroup<T>[] = [];
	for (const item of items) {
		const { year, week } = isoWeek(new Date(item.createdAt));
		const key = `${year}-${week}`;
		let g = groups.at(-1);
		if (!g || g.key !== key) {
			g = { key, label: `KW ${week} / ${year}`, items: [] };
			groups.push(g);
		}
		g.items.push(item);
	}
	return groups;
}
