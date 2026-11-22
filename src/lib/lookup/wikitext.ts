/**
 * Parsing of German Wiktionary (de.wiktionary.org) wikitext.
 *
 * Pure functions only — fetching lives in `wiktionary.ts`.
 */

export type Pos = 'noun' | 'verb' | 'adj' | 'other';
export type Gender = 'm' | 'f' | 'n' | 'mf';

/** One translation offered for a German word. */
export interface Translation {
	/** The foreign word or phrase, e.g. "maison". */
	word: string;
	gender?: Gender;
	/** Transliteration for non-Latin scripts, e.g. "spíti". */
	translit?: string;
	/** German meaning of the table this translation came from, e.g. "Gebäude zum Wohnen". */
	meaning?: string;
	/** Part of speech of the German word in that table. */
	pos: Pos;
}

/** A raw inflected form taken from an overview table. */
export interface RawForm {
	/** Parameter name in the overview table, e.g. "Präsens 3. Person Singular". */
	key: string;
	value: string;
}

/** Information about one foreign word, from its own Wiktionary page. */
export interface ForeignEntry {
	pos: Pos;
	gender?: Gender;
	/** Commons file names of pronunciation recordings, best first. */
	audioFiles: string[];
	/** Inflected forms that differ from the word itself. */
	forms: RawForm[];
	/** Auxiliary verb for compound tenses (French "avoir"/"être"). */
	auxiliary?: string;
}

const POS_NAMES: Record<string, Pos> = {
	Substantiv: 'noun',
	Verb: 'verb',
	Hilfsverb: 'verb',
	Adjektiv: 'adj'
};

function toPos(wortart: string): Pos {
	return POS_NAMES[wortart.trim()] ?? 'other';
}

const GENDER_RE = /\{\{(m|f|n|mf|fm|u|c)\}\}/;

function toGender(raw: string | undefined): Gender | undefined {
	switch (raw) {
		case 'm':
		case 'f':
		case 'n':
			return raw;
		case 'mf':
		case 'fm':
			return 'mf';
		default:
			return undefined;
	}
}

/**
 * Returns the part of a page that belongs to one language, e.g. everything
 * under "== Haus ({{Sprache|Deutsch}}) ==" up to the next language heading.
 * A page can contain several sections for the same language; they are joined.
 */
export function languageSections(wikitext: string, languageName: string): string {
	const headingRe = /^==[^=].*$/gm;
	const headings = [...wikitext.matchAll(headingRe)];
	const parts: string[] = [];
	headings.forEach((h, i) => {
		if (!h[0].includes(`{{Sprache|${languageName}}}`)) return;
		const start = h.index! + h[0].length;
		const end = i + 1 < headings.length ? headings[i + 1].index! : wikitext.length;
		parts.push(wikitext.slice(start, end));
	});
	return parts.join('\n');
}

/** Splits a language section into its word-type blocks ("=== {{Wortart|…}} ==="). */
function wortartBlocks(section: string): { pos: Pos; heading: string; body: string }[] {
	const re = /^===\s*\{\{Wortart\|([^|}]+)\|[^}]*\}\}(.*)$/gm;
	const matches = [...section.matchAll(re)];
	return matches.map((m, i) => {
		const start = m.index! + m[0].length;
		const end = i + 1 < matches.length ? matches[i + 1].index! : section.length;
		return { pos: toPos(m[1]), heading: m[2], body: section.slice(start, end) };
	});
}

/** Removes wiki markup from short text like "[[Gebäude]], das zum ''Wohnen'' dient". */
export function stripMarkup(text: string): string {
	return text
		.replace(/<[^>]+>/g, '')
		.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
		.replace(/\{\{[^{}]*\}\}/g, '')
		.replace(/'{2,}/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Splits at top-level commas/semicolons (not inside {{…}}, [[…]] or (…)). */
function splitTopLevel(text: string): string[] {
	const out: string[] = [];
	let depth = 0;
	let current = '';
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		const two = text.slice(i, i + 2);
		if (two === '{{' || two === '[[') {
			depth++;
			current += two;
			i++;
			continue;
		}
		if (two === '}}' || two === ']]') {
			depth = Math.max(0, depth - 1);
			current += two;
			i++;
			continue;
		}
		if (c === '(') depth++;
		if (c === ')') depth = Math.max(0, depth - 1);
		if ((c === ',' || c === ';') && depth === 0) {
			out.push(current);
			current = '';
			continue;
		}
		current += c;
	}
	out.push(current);
	return out;
}

/** Translation templates: {{Ü|fr|maison}}, {{Ü|fr|zig#zig (Französisch)|zig}}, {{Üt|el|σπίτι|spíti}}. */
const UE_RE = /\{\{Ü(t?)\|([^|}]+)\|([^|}]*)(?:\|([^|}]*))?(?:\|([^|}]*))?\}\}/g;

function parseTranslationChunk(chunk: string, code: string): Omit<Translation, 'pos' | 'meaning'> | null {
	let translit: string | undefined;
	let found = false;
	let text = chunk
		// notes in italics and in parentheses are commentary ("''Großbritannien:''", "(''auch:'' …)")
		.replace(/''[^']*''/g, ' ')
		.replace(/\([^)]*\)/g, ' ')
		.replace(/<[^>]+>/g, ' ');
	const genderMatch = text.match(GENDER_RE);
	text = text.replace(UE_RE, (_all, t, lang, target, p3, p4) => {
		if (lang !== code) return ' ';
		found = true;
		if (t) {
			// {{Üt|lang|word|transliteration|display}}
			translit = p3?.trim() || undefined;
			return (p4?.trim() || target).split('#')[0];
		}
		return (p3?.trim() || target).split('#')[0];
	});
	if (!found) return null;
	const word = stripMarkup(text).replace(/^[\s:–-]+|[\s:–-]+$/g, '');
	if (!word) return null;
	return { word, gender: toGender(genderMatch?.[1]), translit };
}

/** German glosses from the "{{Bedeutungen}}" block, keyed by sense number. */
function parseMeanings(body: string): Map<string, string> {
	const result = new Map<string, string>();
	const block = body.split('{{Bedeutungen}}')[1];
	if (!block) return result;
	for (const line of block.split('\n').slice(1)) {
		if (!line.startsWith(':')) break;
		const m = line.match(/^:\[([^\]]+)\]\s*(.*)$/);
		if (m) result.set(m[1].trim(), stripMarkup(m[2]));
	}
	return result;
}

/**
 * Collects translations into language `code` from a German word's page.
 * Duplicates are removed (keeping the first occurrence and its meaning).
 */
export function parseTranslations(wikitext: string, code: string): Translation[] {
	const german = languageSections(wikitext, 'Deutsch');
	const result: Translation[] = [];
	const seen = new Set<string>();
	const lineRe = new RegExp(`^\\*+\\{\\{${code.replace(/[-]/g, '\\-')}(\\|[^}]*)?\\}\\}[^:]*:(.*)$`);

	for (const block of wortartBlocks(german)) {
		const meanings = parseMeanings(block.body);
		const tables = block.body.split(/\{\{Ü-Tabelle\|/).slice(1);
		for (const table of tables) {
			const head = table.match(/^([^|]*)\|(?:G=([^|\n]*)\|)?/);
			const senseNo = head?.[1]?.trim() ?? '';
			const meaning = stripMarkup(head?.[2] ?? '') || meanings.get(senseNo) || undefined;
			for (const line of table.split('\n')) {
				const m = line.match(lineRe);
				if (!m) continue;
				for (const chunk of splitTopLevel(m[2])) {
					const t = parseTranslationChunk(chunk, code);
					if (!t) continue;
					const key = `${t.word}|${t.gender ?? ''}`;
					if (seen.has(key)) continue;
					seen.add(key);
					result.push({ ...t, meaning, pos: block.pos });
				}
			}
		}
	}
	return result;
}

/** Template parameters that are not inflected forms. */
const NON_FORM_KEYS = /^(Genus|Bild.*|Hilfsverb|Weitere.*|Bemerkung.*|Kasus.*|Klasse.*|Typ.*|\d+)$/i;

function parseOverview(body: string): { forms: RawForm[]; params: Map<string, string> } {
	const forms: RawForm[] = [];
	const params = new Map<string, string>();
	const m = body.match(/\{\{[^{}|]*Übersicht[^{}|]*\n?((?:\|[^\n]*\n?)*)\}\}/);
	if (!m) return { forms, params };
	for (const line of m[1].split('\n')) {
		const p = line.match(/^\|([^=]+)=(.*)$/);
		if (!p) continue;
		const key = p[1].trim();
		const value = stripMarkup(p[2]);
		params.set(key, value);
		if (NON_FORM_KEYS.test(key)) continue;
		if (!value || value === '—' || value === '-' || value === '?') continue;
		forms.push({ key, value });
	}
	return { forms, params };
}

function parseAudio(body: string): string[] {
	const files: string[] = [];
	for (const m of body.matchAll(/\{\{Audio\|([^|}]+)/g)) {
		const f = m[1].trim();
		if (f && !files.includes(f)) files.push(f);
	}
	return files;
}

/** All recordings linked in a language's section of a page ("Fr-le.ogg" on page "le"). */
export function sectionAudio(wikitext: string, languageName: string): string[] {
	return parseAudio(languageSections(wikitext, languageName));
}

/**
 * Reads the section of a foreign word (e.g. "maison", language "Französisch").
 * If the page has several word types, the one matching `preferredPos` wins.
 */
export function parseForeignEntry(
	wikitext: string,
	languageName: string,
	word: string,
	preferredPos: Pos
): ForeignEntry | null {
	const section = languageSections(wikitext, languageName);
	if (!section) return null;
	const blocks = wortartBlocks(section);
	if (blocks.length === 0) return null;
	const block = blocks.find((b) => b.pos === preferredPos) ?? blocks[0];
	const { forms, params } = parseOverview(block.body);
	const gender = toGender(block.heading.match(GENDER_RE)?.[1]) ?? toGender(params.get('Genus'));

	// Recordings of the bare word first ("Fr-chien.ogg" before "Fr-une maison-….ogg").
	const audioFiles = parseAudio(block.body).sort((a, b) => score(b) - score(a));
	function score(file: string): number {
		const base = file.replace(/\.[a-z0-9]+$/i, '').toLowerCase();
		const w = word.toLowerCase();
		if (base.endsWith(`-${w}`) || base === w) return 2;
		return base.includes(w) ? 1 : 0;
	}

	return {
		pos: block.pos,
		gender,
		audioFiles,
		forms: forms.filter((f) => f.value !== word),
		auxiliary: params.get('Hilfsverb') || undefined
	};
}

/**
 * All parameters of the inflection table ("… Übersicht") of a word, e.g.
 * for German "gehen": Präsens_ich=gehe, Präteritum_ich=ging, Hilfsverb=sein.
 * The word-type block matching `pos` is preferred.
 */
export function overviewParams(wikitext: string, languageName: string, pos: Pos): Map<string, string> {
	const blocks = wortartBlocks(languageSections(wikitext, languageName));
	const block = blocks.find((b) => b.pos === pos) ?? blocks[0];
	return block ? parseOverview(block.body).params : new Map();
}
