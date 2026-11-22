/**
 * Brings cards saved by older app versions up to date. Special forms saved
 * before German prompts existed ("Präsens: ich" instead of "ich gehe") get
 * their German prompt looked up once, when online.
 */
import { listCards, setPrompts, type Card } from '#lib/db/index.ts';
import type { Language } from '#lib/languages.ts';
import { getDetails } from '#lib/lookup/index.ts';

let running: Promise<boolean> | undefined;

/** Returns true if any card was changed. Never throws. */
export function addMissingPrompts(lang: Language): Promise<boolean> {
	running ??= run(lang).finally(() => (running = undefined));
	return running;
}

async function run(lang: Language): Promise<boolean> {
	if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
	const cards = await listCards(lang.code);
	const outdated = cards.filter((c) => c.parentId && c.prompt === undefined);
	if (outdated.length === 0) return false;

	const prompts = new Map<string, string>();
	const parents = new Map(cards.filter((c) => !c.parentId).map((c) => [c.id, c]));
	const byParent = new Map<string, Card[]>();
	for (const c of outdated) byParent.set(c.parentId!, [...(byParent.get(c.parentId!) ?? []), c]);
	for (const [parentId, forms] of byParent) {
		const main = parents.get(parentId);
		if (!main?.word) continue;
		try {
			const details = await getDetails({ word: main.word, pos: main.pos ?? 'other', gender: main.gender }, lang, main.german);
			for (const form of forms) {
				const match = details.forms.find((f) => f.label === form.formLabel && f.answer === form.answer);
				// "" marks "looked up, no German form available" so it is not retried
				prompts.set(form.id, match?.prompt ?? '');
			}
		} catch {
			// offline or rate-limited: try again next time
		}
	}
	if (prompts.size) await setPrompts(prompts);
	return prompts.size > 0;
}
