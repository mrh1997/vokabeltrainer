/**
 * Live dictionary lookups against Wikimedia's public APIs (used only while
 * adding words; the quiz works from IndexedDB alone).
 *
 * - German Wiktionary: completion, translations, foreign word details
 * - Wikimedia Commons: mp3 version of pronunciation recordings
 */
import type { Language } from '#lib/languages.ts';
import { buildFormCandidates, buildMainAnswer, type FormCandidate } from './answers';
import { recordingSays, spokenName } from './recordings';
import { parseForeignEntry, parseTranslations, type Gender, type Pos, type Translation } from './wikitext';

export type { FormCandidate, Translation, Pos, Gender };

const WIKTIONARY = 'https://de.wiktionary.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
// Wikimedia asks API clients to identify themselves; browsers can't set User-Agent.
const HEADERS = { 'Api-User-Agent': 'Vokabeltrainer/1.0 (static web app; github.com/mrh1997/vokabeltrainer)' };

export class LookupError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Calls a MediaWiki API with CORS enabled; retries when rate-limited. */
async function api(base: string, params: Record<string, string>, signal?: AbortSignal): Promise<any> {
	const url = `${base}?${new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params })}`;
	for (let attempt = 0; ; attempt++) {
		let res: Response;
		try {
			res = await fetch(url, { headers: HEADERS, signal });
		} catch (e) {
			if ((e as Error).name === 'AbortError') throw e;
			throw new LookupError('Keine Verbindung zum Wörterbuch. Bist du online?');
		}
		if (res.ok) {
			const text = await res.text();
			if (text.startsWith('{') || text.startsWith('[')) return JSON.parse(text);
		}
		if (attempt >= 2) throw new LookupError('Das Wörterbuch ist gerade überlastet. Bitte gleich nochmal versuchen.');
		await sleep(1500 * (attempt + 1));
	}
}

const pageCache = new Map<string, Promise<string | null>>();

/** Wikitext of a German Wiktionary page, or null if the page does not exist. */
function wikitext(title: string, signal?: AbortSignal): Promise<string | null> {
	let p = pageCache.get(title);
	if (!p) {
		p = api(WIKTIONARY, { action: 'parse', prop: 'wikitext', redirects: '1', page: title }, signal).then(
			(d) => (d.parse ? (d.parse.wikitext as string) : null)
		);
		p.catch(() => pageCache.delete(title));
		pageCache.set(title, p);
	}
	return p;
}

/** Up to 10 German Wiktionary page titles starting with `prefix`. */
export async function completeGerman(prefix: string, signal?: AbortSignal): Promise<string[]> {
	const q = prefix.trim();
	if (!q) return [];
	const d = await api(WIKTIONARY, { action: 'opensearch', namespace: '0', limit: '10', search: q }, signal);
	return (d[1] as string[]).filter((t) => !t.includes(':'));
}

/** All translations of a German word into the given language. */
export async function getTranslations(german: string, lang: Language, signal?: AbortSignal): Promise<Translation[]> {
	const text = await wikitext(german, signal);
	if (!text) return [];
	return parseTranslations(text, lang.code);
}

export interface WordDetails {
	/** Exact text to type, with article. */
	answer: string;
	pos: Pos;
	gender?: Gender;
	forms: FormCandidate[];
	/** Commons recording saying exactly `answer`; absent → speech synthesis. */
	audioFile?: string;
}

/** Looks up the foreign word's own page: gender, forms, pronunciation. */
export async function getDetails(t: Translation, lang: Language, signal?: AbortSignal): Promise<WordDetails> {
	const text = await wikitext(t.word, signal);
	const entry = text ? parseForeignEntry(text, lang.name, t.word, t.pos) : null;
	const gender = t.gender ?? entry?.gender;
	const answer = buildMainAnswer(lang.code, t.word, t.pos, gender);
	return {
		answer,
		pos: t.pos,
		gender,
		forms: entry ? buildFormCandidates(lang.code, t.word, entry) : [],
		audioFile: await findRecording(answer, t.word, entry?.audioFiles ?? [], lang, signal)
	};
}

/**
 * A recording that says exactly the answer to type, including article or
 * "to" ("a dog", "to go"). Without one, the card uses speech synthesis for
 * the full answer, so the learner never hears just "dog" for "a dog".
 */
async function findRecording(
	answer: string,
	word: string,
	files: string[],
	lang: Language,
	signal?: AbortSignal
): Promise<string | undefined> {
	const exact = files.find((f) => recordingSays(f, answer));
	if (exact) return exact;
	const fromLinguaLibre = await findLinguaLibre(answer, lang, signal);
	if (fromLinguaLibre) return fromLinguaLibre;
	// Bare words (adjectives, French verbs…): accept a recording that contains the word.
	if (answer === word) {
		const w = word.toLowerCase();
		return files.find((f) => spokenName(f).split(/[-\s]/).includes(w));
	}
	return undefined;
}

/** Searches Commons for a Lingua Libre recording "LL-Q… (fra)-<speaker>-<word>.wav". */
async function findLinguaLibre(word: string, lang: Language, signal?: AbortSignal): Promise<string | undefined> {
	try {
		const d = await api(
			COMMONS,
			{ action: 'query', list: 'search', srnamespace: '6', srlimit: '50', srsearch: `intitle:"(${lang.iso3})" intitle:"${word}"` },
			signal
		);
		const suffix = `-${word}.wav`.toLowerCase();
		const hit = (d.query?.search ?? []).find(
			(r: { title: string }) => r.title.startsWith('File:LL-') && r.title.toLowerCase().endsWith(suffix)
		);
		return hit?.title.slice('File:'.length);
	} catch (e) {
		if ((e as Error).name === 'AbortError') throw e;
		return undefined;
	}
}

/** Downloads the mp3 version of a Commons recording (Safari can't play ogg). */
export async function downloadAudio(file: string, signal?: AbortSignal): Promise<Blob | undefined> {
	try {
		const d = await api(COMMONS, { action: 'query', prop: 'videoinfo', viprop: 'url|derivatives', titles: `File:${file}` }, signal);
		const info = d.query?.pages?.[0]?.videoinfo?.[0];
		if (!info) return undefined;
		const mp3 = (info.derivatives ?? []).find((x: { type: string }) => x.type === 'audio/mpeg')?.src as string | undefined;
		const url = mp3 ?? (/\.mp3$/i.test(file) ? info.url : undefined);
		if (!url) return undefined;
		for (let attempt = 0; attempt < 3; attempt++) {
			const res = await fetch(url, { signal });
			if (res.ok) return await res.blob();
			if (res.status !== 429) return undefined;
			await sleep(1500 * (attempt + 1));
		}
		return undefined;
	} catch (e) {
		if ((e as Error).name === 'AbortError') throw e;
		return undefined;
	}
}
