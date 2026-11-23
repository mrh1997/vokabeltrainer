/**
 * Live dictionary lookups against Wikimedia's public APIs (used only while
 * adding words; the quiz works from IndexedDB alone).
 *
 * - German Wiktionary: completion, translations, foreign word details
 * - Wikimedia Commons: mp3 version of pronunciation recordings
 */
import type { Language } from '#lib/languages.ts';
import { buildFormCandidates, buildMainAnswer, type FormCandidate } from './answers';
import { descriptionAddsWords, linguaLibreSpeaker, recordingSays, spokenWords } from './recordings';
import { germanMainPrompt } from './german';
import { germanNounGender, overviewParams, parseForeignEntry, sectionAudio, parseTranslations, type Gender, type Pos, type Translation } from './wikitext';

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
	/** German prompt with article for nouns ("der Hund", "ein Hund"), if the answer has one. */
	prompt?: string;
	pos: Pos;
	gender?: Gender;
	forms: FormCandidate[];
	/**
	 * Commons recordings that, played one after another, say exactly
	 * `answer`: one file for the whole answer, or one per word.
	 * Empty → speech synthesis.
	 */
	audioFiles: string[];
}

/**
 * Looks up the foreign word's own page: gender, forms, pronunciation.
 * `german` is the German word it translates; its inflection table supplies
 * the German prompts for the special forms ("ich gehe" for "je vais").
 */
export async function getDetails(t: Translation, lang: Language, german?: string, signal?: AbortSignal): Promise<WordDetails> {
	const [text, germanText] = await Promise.all([wikitext(t.word, signal), german ? wikitext(german, signal) : null]);
	const entry = text ? parseForeignEntry(text, lang.name, t.word, t.pos) : null;
	const germanTable = german && germanText ? { word: german, table: overviewParams(germanText, 'Deutsch', t.pos) } : undefined;
	const gender = t.gender ?? entry?.gender;
	const answer = buildMainAnswer(lang.code, t.word, t.pos, gender);
	return {
		answer,
		prompt: german && germanText ? germanMainPrompt(lang.code, german, t.pos, t.word, answer, germanNounGender(germanText)) : undefined,
		pos: t.pos,
		gender,
		forms: entry ? buildFormCandidates(lang.code, t.word, entry, germanTable) : [],
		// the word type's own recordings first, then those of the same spelling
		// elsewhere on the page (the noun "aller" sounds like the verb)
		audioFiles: await findRecordings(answer, lang, [...new Set([...(entry?.audioFiles ?? []), ...(text ? sectionAudio(text, lang.name) : [])])], signal)
	};
}

/**
 * Recordings that together say exactly the answer to type, including
 * article or pronoun ("le chien", "je vais"). Preferred is one recording of
 * the whole answer; otherwise one per word ("le" + "chien"), all by the same
 * Lingua Libre speaker where possible. If any word has no recording, the
 * result is empty and the card uses speech synthesis for the full answer,
 * so the learner never hears just "chien" for "le chien".
 * `pageFiles` are recordings already known from the word's Wiktionary page.
 */
export async function findRecordings(
	answer: string,
	lang: Language,
	pageFiles: string[] = [],
	signal?: AbortSignal
): Promise<string[]> {
	const whole = await recordingsOf(answer, lang, pageFiles, signal);
	if (whole.length) return [whole[0]];
	const words = spokenWords(answer);
	if (words.length < 2) return [];
	const perWord: string[][] = [];
	for (const w of words) {
		const files = await recordingsOf(w, lang, [], signal, true);
		if (!files.length) return [];
		perWord.push(files);
	}
	// The speaker who recorded the most of the words, so the voice stays the same.
	const count = new Map<string, number>();
	perWord.forEach((files, i) => {
		const speakers = new Set(files.map((f) => linguaLibreSpeaker(f, words[i])).filter((s) => s !== undefined));
		for (const s of speakers) count.set(s, (count.get(s) ?? 0) + 1);
	});
	const best = [...count].sort((a, b) => b[1] - a[1])[0]?.[0];
	return perWord.map((files, i) => files.find((f) => linguaLibreSpeaker(f, words[i]) === best) ?? files[0]);
}

/**
 * Recordings saying exactly `text`: Lingua Libre first (its file names are
 * reliable), then the ones linked on Wiktionary whose description doesn't
 * reveal extra words. `ownPage` also looks at the Wiktionary page of `text`.
 */
async function recordingsOf(
	text: string,
	lang: Language,
	pageFiles: string[],
	signal?: AbortSignal,
	ownPage = false
): Promise<string[]> {
	const ll = await findLinguaLibre(text, lang, signal);
	if (ll.length) return ll;
	let files = pageFiles;
	if (ownPage) {
		const page = await wikitext(text, signal).catch(() => null);
		files = page ? sectionAudio(page, lang.name) : [];
	}
	return verified(files.filter((f) => recordingSays(f, text)), text, signal);
}

/** Drops recordings whose Commons description says they contain more than `text`. */
async function verified(files: string[], text: string, signal?: AbortSignal): Promise<string[]> {
	if (!files.length) return [];
	try {
		const d = await api(
			COMMONS,
			{
				action: 'query',
				prop: 'imageinfo',
				iiprop: 'extmetadata',
				iiextmetadatafilter: 'ImageDescription',
				titles: files.slice(0, 50).map((f) => `File:${f}`).join('|')
			},
			signal
		);
		const descriptions = new Map<string, string>();
		for (const p of d.query?.pages ?? []) {
			const html: string = p.imageinfo?.[0]?.extmetadata?.ImageDescription?.value ?? '';
			descriptions.set(String(p.title).slice('File:'.length).replace(/_/g, ' '), html.replace(/<[^>]*>/g, ''));
		}
		return files.filter((f) => !descriptionAddsWords(descriptions.get(f.replace(/_/g, ' ')) ?? '', text));
	} catch (e) {
		if ((e as Error).name === 'AbortError') throw e;
		return [];
	}
}

/** Lingua Libre recordings "LL-Q… (fra)-<speaker>-<text>.wav" on Commons. */
async function findLinguaLibre(text: string, lang: Language, signal?: AbortSignal): Promise<string[]> {
	// Lucene regex on the title finds even very short words like "le" among thousands of phrases.
	const re = text.replace(/[.?+*|{}[\]()"\\#@&<>~/]/g, '\\$&');
	try {
		const d = await api(
			COMMONS,
			{
				action: 'query',
				list: 'search',
				srnamespace: '6',
				srlimit: '500',
				srprop: '',
				srsearch: `intitle:"(${lang.iso3})" intitle:/-${re}\\.wav/i`
			},
			signal
		);
		return (d.query?.search ?? [])
			.map((r: { title: string }) => r.title.slice('File:'.length))
			.filter((f: string) => linguaLibreSpeaker(f, text) !== undefined);
	} catch (e) {
		if ((e as Error).name === 'AbortError') throw e;
		return [];
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
