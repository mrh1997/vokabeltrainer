/**
 * Decides whether an inflected form is "standard", i.e. built by the
 * language's regular rule (roof → roofs, parler → il parle, walk → walked).
 * Standard forms are not offered as special forms.
 *
 * Rules exist for en, fr, es, it, pt, nl. For other languages nothing is
 * considered standard, so all forms from the dictionary are offered.
 */
import type { Pos } from './wikitext';

/** Normalised meaning of an overview-table parameter. */
export interface FormKind {
	/** e.g. 'plural', 'present', 'participle', 'past', 'ing', 'comparative', 'superlative', 'fem', 'mascPl', 'femPl', … */
	kind: string;
	/** Person + number for verb forms: '1S' … '3P'. */
	person?: string;
}

const PERSON_WORDS: Record<string, string> = {
	io: '1S',
	tu: '2S',
	'lui, lei': '3S',
	noi: '1P',
	voi: '2P',
	loro: '3P',
	ich: '1S',
	du: '2S',
	'er, sie, es': '3S'
};

/** Maps an overview-table key (German Wiktionary) to a language-independent form kind. */
export function formKind(key: string, pos: Pos): FormKind {
	let m = key.match(/^Präsens (\d)\. Person (Singular|Plural)$/);
	if (m) return { kind: 'present', person: `${m[1]}${m[2][0]}` };
	m = key.match(/^(Gegenwart|Präsens|Imperfekt|Konjunktiv II|Befehl|Präteritum)_(.+)$/);
	if (m && PERSON_WORDS[m[2]]) {
		const kind = { Gegenwart: 'present', Präsens: 'present', Imperfekt: 'imperfect', 'Konjunktiv II': 'subjunctive2', Befehl: 'imperative', Präteritum: 'past' }[m[1]]!;
		return { kind, person: PERSON_WORDS[m[2]] };
	}
	switch (key) {
		case 'Plural':
			return { kind: 'plural' };
		case 'present_he, she, it':
			return { kind: 'present', person: '3S' };
		case 'past_simple_I':
			return { kind: 'past', person: '1S' };
		case 'past participle':
		case 'Partizip II':
			return { kind: 'participle' };
		case 'present participle':
			return { kind: 'ing' };
		case 'Historisches Perfekt':
			return { kind: 'pastHistoric', person: '1S' };
		case 'Komparativ':
			return { kind: 'comparative' };
		case 'Superlativ':
			return { kind: 'superlative' };
	}
	// Adjective tables, and French verb tables that list the participle by gender/number.
	const prefix = pos === 'verb' ? 'participle' : '';
	switch (key) {
		case 'Maskulinum Singular':
			return { kind: prefix || 'mascSg' };
		case 'Femininum Singular':
			return { kind: prefix ? 'participleFem' : 'fem' };
		case 'Maskulinum Plural':
			return { kind: prefix ? 'participleMascPl' : 'mascPl' };
		case 'Femininum Plural':
			return { kind: prefix ? 'participleFemPl' : 'femPl' };
	}
	return { kind: key };
}

const VOWEL = 'aeiouàâäéèêëîïôöùûü';
const isVowel = (c: string | undefined) => !!c && VOWEL.includes(c);

/** English: +s / +es / y→ies. */
function enS(w: string): string[] {
	const out = [w + 's'];
	if (/(s|x|z|ch|sh|o)$/.test(w)) out.push(w + 'es');
	if (/[^aeiou]y$/.test(w)) out.push(w.slice(0, -1) + 'ies');
	return out;
}

/** English suffix rules shared by -ed, -ing, -er, -est (incl. dropped e, doubled consonant, y→i). */
function enSuffix(w: string, suffix: string): string[] {
	const out = [w + suffix];
	if (w.endsWith('e') && isVowel(suffix[0])) out.push(w.slice(0, -1) + suffix);
	if (/[^aeiou]y$/.test(w) && suffix !== 'ing') out.push(w.slice(0, -1) + 'i' + suffix);
	if (w.endsWith('ie') && suffix === 'ing') out.push(w.slice(0, -2) + 'ying');
	if (/[^aeiou][aeiou][^aeiouwxy]$/.test(w)) out.push(w + w.at(-1) + suffix);
	return out;
}

function english(pos: Pos, lemma: string, k: FormKind): string[] {
	if (pos === 'noun' && k.kind === 'plural') return enS(lemma);
	if (pos === 'verb') {
		if (k.kind === 'present' && k.person === '3S') return enS(lemma);
		if (k.kind === 'past' || k.kind === 'participle') return enSuffix(lemma, 'ed');
		if (k.kind === 'ing') return enSuffix(lemma, 'ing');
	}
	if (pos === 'adj') {
		if (k.kind === 'comparative') return [...enSuffix(lemma, 'er'), `more ${lemma}`];
		if (k.kind === 'superlative') return [...enSuffix(lemma, 'est'), `most ${lemma}`];
	}
	return [];
}

const PERSONS = ['1S', '2S', '3S', '1P', '2P', '3P'];

function personEndings(person: string | undefined, endings: string[]): string | undefined {
	const i = PERSONS.indexOf(person ?? '');
	return i >= 0 ? endings[i] : undefined;
}

/** Regular French participle of a verb (parler → parlé, finir → fini). */
function frParticiple(lemma: string): string[] {
	if (lemma.endsWith('er')) return [lemma.slice(0, -2) + 'é'];
	if (lemma.endsWith('ir')) return [lemma.slice(0, -2) + 'i'];
	return [];
}

function french(pos: Pos, lemma: string, k: FormKind, forms: Map<string, string>): string[] {
	if (pos === 'noun' && k.kind === 'plural') return [lemma + 's'];
	if (pos === 'adj') {
		const fem = /e$/.test(lemma) ? lemma : lemma + 'e';
		if (k.kind === 'fem') return [fem];
		if (k.kind === 'mascPl') return [/[sx]$/.test(lemma) ? lemma : lemma + 's'];
		if (k.kind === 'femPl') return [(forms.get('fem') ?? fem) + 's'];
	}
	if (pos === 'verb') {
		const stem = lemma.slice(0, -2);
		if (k.kind === 'present') {
			if (lemma.endsWith('er')) {
				const e = personEndings(k.person, ['e', 'es', 'e', 'ons', 'ez', 'ent'])!;
				const out = [stem + e];
				// orthographic adjustments: mangeons, commençons
				if (e === 'ons' && stem.endsWith('g')) out.push(stem + 'eons');
				if (e === 'ons' && stem.endsWith('c')) out.push(stem.slice(0, -1) + 'çons');
				return out;
			}
			if (lemma.endsWith('ir')) return [stem + personEndings(k.person, ['is', 'is', 'it', 'issons', 'issez', 'issent'])];
			return [];
		}
		const part = forms.get('participle') ?? frParticiple(lemma)[0];
		if (k.kind === 'participle') return frParticiple(lemma);
		if (k.kind === 'participleFem') return [part + 'e'];
		if (k.kind === 'participleMascPl') return [part + 's'];
		if (k.kind === 'participleFemPl') return [part + 'es'];
	}
	return [];
}

function spanish(pos: Pos, lemma: string, k: FormKind): string[] {
	if (pos === 'noun' && k.kind === 'plural') {
		if (lemma.endsWith('z')) return [lemma.slice(0, -1) + 'ces'];
		return isVowel(lemma.at(-1)) ? [lemma + 's'] : [lemma + 'es'];
	}
	if (pos === 'verb') {
		const stem = lemma.slice(0, -2);
		const type = lemma.slice(-2);
		if (k.kind === 'present') {
			const table: Record<string, string[]> = {
				ar: ['o', 'as', 'a', 'amos', 'áis', 'an'],
				er: ['o', 'es', 'e', 'emos', 'éis', 'en'],
				ir: ['o', 'es', 'e', 'imos', 'ís', 'en']
			};
			const e = table[type] && personEndings(k.person, table[type]);
			return e ? [stem + e] : [];
		}
		if (k.kind === 'participle') return type === 'ar' ? [stem + 'ado'] : [stem + 'ido'];
	}
	return [];
}

function italian(pos: Pos, lemma: string, k: FormKind): string[] {
	if (pos === 'noun' && k.kind === 'plural') {
		if (lemma.endsWith('o') || lemma.endsWith('e')) return [lemma.slice(0, -1) + 'i'];
		if (lemma.endsWith('a')) return [lemma.slice(0, -1) + 'e'];
		return [];
	}
	if (pos === 'verb') {
		const stem = lemma.slice(0, -3);
		const type = lemma.slice(-3);
		const v = { are: 'a', ere: 'e', ire: 'i' }[type];
		if (!v) return [];
		switch (k.kind) {
			case 'present': {
				const table: Record<string, string[]> = {
					are: ['o', 'i', 'a', 'iamo', 'ate', 'ano'],
					ere: ['o', 'i', 'e', 'iamo', 'ete', 'ono'],
					ire: ['o', 'i', 'e', 'iamo', 'ite', 'ono']
				};
				const out = [stem + personEndings(k.person, table[type])];
				if (type === 'ire') out.push(stem + personEndings(k.person, ['isco', 'isci', 'isce', 'iamo', 'ite', 'iscono']));
				return out;
			}
			case 'participle':
				return [stem + { are: 'ato', ere: 'uto', ire: 'ito' }[type]];
			case 'imperfect':
				return k.person === '1S' ? [stem + v + 'vo'] : [];
			case 'pastHistoric':
				return [stem + { are: 'ai', ere: 'ei', ire: 'ii' }[type], ...(type === 'ere' ? [stem + 'etti'] : [])];
			case 'subjunctive2':
				return k.person === '1S' ? [stem + v + 'ssi'] : [];
			case 'imperative':
				if (k.person === '2S') return type === 'are' ? [stem + 'a'] : [stem + 'i', stem + 'isci'];
				if (k.person === '2P') return [stem + v + 'te'];
				return [];
		}
	}
	return [];
}

function portuguese(pos: Pos, lemma: string, k: FormKind): string[] {
	if (pos === 'noun' && k.kind === 'plural') return isVowel(lemma.at(-1)) ? [lemma + 's'] : [lemma + 'es'];
	return [];
}

function dutch(pos: Pos, lemma: string, k: FormKind): string[] {
	if (pos === 'noun' && k.kind === 'plural') {
		const out = [lemma + 's', lemma + "'s", lemma + 'en', lemma + 'n'];
		if (/[^aeiou][aeiou][^aeiou]$/.test(lemma)) out.push(lemma + lemma.at(-1) + 'en');
		return out;
	}
	return [];
}

/**
 * True if `value` is what the regular rule of the language produces.
 * `forms` holds other forms of the same word by kind (e.g. the actual
 * feminine form, so "belle → belles" counts as standard).
 */
export function isStandardForm(
	lang: string,
	pos: Pos,
	lemma: string,
	k: FormKind,
	value: string,
	forms: Map<string, string> = new Map()
): boolean {
	const rules: Record<string, () => string[]> = {
		en: () => english(pos, lemma, k),
		fr: () => french(pos, lemma, k, forms),
		es: () => spanish(pos, lemma, k),
		it: () => italian(pos, lemma, k),
		pt: () => portuguese(pos, lemma, k),
		nl: () => dutch(pos, lemma, k)
	};
	const expected = rules[lang]?.();
	return !!expected && expected.includes(value);
}
