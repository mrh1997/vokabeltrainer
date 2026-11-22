/**
 * Getting a real recording for every card: one Commons recording of the
 * whole answer, or single-word recordings joined together ("le" + "chien").
 * Cards that have none yet get one in the background while online, so the
 * quiz rarely depends on the device's speech voices.
 */
import { listCards, setCardAudio, type Card } from '#lib/db/index.ts';
import { findLanguage, type Language } from '#lib/languages.ts';
import { downloadAudio, findRecordings } from '#lib/lookup/index.ts';
import { recordingSays } from '#lib/lookup/recordings.ts';
import { combineRecordings } from './combine';

/** Storage key of a joined recording. */
export function combinedId(lang: string, answer: string): string {
	return `combined:${lang}:${answer}`;
}

/** True if the card's stored recording says exactly its answer. */
export function audioFits(card: Pick<Card, 'audioId' | 'answer' | 'lang'>): boolean {
	const id = card.audioId;
	return !!id && (id === combinedId(card.lang, card.answer) || recordingSays(id, card.answer));
}

/**
 * Downloads the recordings `files` (found by the lookup; searched when
 * omitted) and joins them if there are several. Undefined if any is missing.
 */
export async function fetchPronunciation(
	answer: string,
	lang: Language,
	files?: string[],
	signal?: AbortSignal
): Promise<{ id: string; blob: Blob } | undefined> {
	files ??= await findRecordings(answer, lang, [], signal);
	if (!files.length) return undefined;
	const blobs = await Promise.all(files.map((f) => downloadAudio(f, signal)));
	if (blobs.some((b) => !b)) return undefined;
	if (files.length === 1) return { id: files[0], blob: blobs[0]! };
	try {
		return { id: combinedId(lang.code, answer), blob: await combineRecordings(blobs as Blob[]) };
	} catch {
		return undefined; // not decodable
	}
}

/** Search again after this long for cards that had no recording. */
const RETRY_MS = 7 * 24 * 3600 * 1000;
const inFlight = new Map<string, Promise<Blob | undefined>>();

const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;

/**
 * Finds, stores and returns a recording for a card without a fitting one.
 * Updates `card.audioId`. `force` ignores when the last search was.
 */
export function ensureAudio(card: Card, force = false, signal?: AbortSignal): Promise<Blob | undefined> {
	const lang = findLanguage(card.lang);
	if (!lang || !online()) return Promise.resolve(undefined);
	if (!force && card.audioCheckedAt && Date.now() - card.audioCheckedAt < RETRY_MS) return Promise.resolve(undefined);
	let p = inFlight.get(card.id);
	if (!p) {
		p = (async () => {
			const audio = await fetchPronunciation(card.answer, lang, undefined, signal);
			await setCardAudio(card.id, audio);
			card.audioCheckedAt = Date.now();
			if (audio) card.audioId = audio.id;
			return audio?.blob;
		})()
			.catch(() => undefined)
			.finally(() => inFlight.delete(card.id));
		inFlight.set(card.id, p);
	}
	return p;
}

const filling = new Map<string, Promise<void>>();

/** Gets recordings for all cards of a language that have none yet, one after another. */
export function fillMissingAudio(lang: string): Promise<void> {
	const running = filling.get(lang);
	if (running) return running.then(() => fillMissingAudio(lang));
	const p = (async () => {
		for (const card of await listCards(lang)) {
			if (!online()) return;
			if (!audioFits(card)) await ensureAudio(card);
		}
	})()
		.catch(() => {})
		.finally(() => filling.delete(lang));
	filling.set(lang, p);
	return p;
}
