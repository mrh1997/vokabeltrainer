/**
 * Brings cards saved by older app versions up to date: when the rules for
 * German prompts or answers changed since a card was saved (special forms without
 * "ich gehe", plurals without "Mäuse", nouns without "der Hund",
 * "a Monday" instead of "Monday"), it is looked up once more, when online.
 * Progress is kept.
 */
import { listCards, PROMPT_RULES, setPrompts, type Card, type PromptUpdate } from '#lib/db/index.ts';
import type { Language } from '#lib/languages.ts';
import { getTexts } from '#lib/lookup/index.ts';

let running: Promise<boolean> | undefined;

/** Returns true if any card was changed. Never throws. */
export function addMissingPrompts(lang: Language): Promise<boolean> {
	running ??= run(lang).finally(() => (running = undefined));
	return running;
}

// rules version 3 concerns only English main cards; everything else is fine since version 2
const outdated = (c: Card) => (c.promptRules ?? 0) < (c.lang === 'en' && !c.parentId ? PROMPT_RULES : 2);

async function run(lang: Language): Promise<boolean> {
	if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
	const cards = await listCards(lang.code);
	const outdatedForms = cards.filter((c) => c.parentId && outdated(c));
	// only nouns whose answer has an article get a prompt of their own ("der Hund")
	const outdatedMains = cards.filter((c) => !c.parentId && c.word && c.pos === 'noun' && c.answer !== c.word && outdated(c));
	if (outdatedForms.length === 0 && outdatedMains.length === 0) return false;

	const updates = new Map<string, PromptUpdate>();
	const parents = new Map(cards.filter((c) => !c.parentId).map((c) => [c.id, c]));
	const byParent = new Map<string, Card[]>(outdatedMains.map((c) => [c.id, []]));
	for (const c of outdatedForms) byParent.set(c.parentId!, [...(byParent.get(c.parentId!) ?? []), c]);
	for (const [parentId, forms] of byParent) {
		const main = parents.get(parentId);
		if (!main?.word) continue;
		try {
			const details = await getTexts({ word: main.word, pos: main.pos ?? 'other', gender: main.gender }, lang, main.german);
			// "" marks "looked up, no German prompt available"
			if (outdatedMains.includes(main))
				updates.set(main.id, { prompt: details.prompt ?? '', answer: lang.code === 'en' ? details.answer : undefined });
			for (const form of forms) {
				// the label may have changed with the rules ("Plural 1" → "Plural"); then the answer identifies the form
				const sameAnswer = details.forms.filter((f) => f.answer === form.answer);
				const match = sameAnswer.find((f) => f.label === form.formLabel) ?? (sameAnswer.length === 1 ? sameAnswer[0] : undefined);
				updates.set(form.id, { prompt: match?.prompt ?? form.prompt ?? '', formLabel: match?.label });
			}
		} catch {
			// offline or rate-limited: try again next time
		}
	}
	if (updates.size) await setPrompts(updates);
	return updates.size > 0;
}
