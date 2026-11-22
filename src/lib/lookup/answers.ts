/**
 * Builds the exact text the learner has to type: the main answer with its
 * article ("la maison", "a house", "to go") and the special forms with
 * German labels ("er/sie/es (Präsens)" → "il va").
 *
 * Rules exist for a few languages; every other language uses the bare word.
 */
import type { ForeignEntry, Gender, Pos } from './wikitext';
import { formKind, isStandardForm, type FormKind } from './regular';
import { germanPrompt } from './german';

export interface FormCandidate {
	/** Grammatical description, e.g. "Präsens: ich" (fallback display, identifies the form). */
	label: string;
	/** German counterpart shown in the quiz, e.g. "ich gehe" (absent if unknown). */
	prompt?: string;
	/** Exact text to type, e.g. "les chevaux". */
	answer: string;
}

const VOWEL = /^[aeiouyàâäæéèêëîïôœùûüÿ]/i;

/** French words starting with an "h aspiré" keep le/la instead of l'. */
const FR_H_ASPIRE = new Set(
	'hache haie haine hall halte hamac hameau hamburger hamster hanche handicap hangar hareng haricot harpe hasard hausse haut hauteur hérisson hernie héros hêtre hibou hiérarchie hockey homard honte hoquet hors hotte houx hublot huit hurlement hutte'.split(' ')
);

function frElides(word: string): boolean {
	const w = word.toLowerCase();
	if (VOWEL.test(w)) return true;
	return w.startsWith('h') && !FR_H_ASPIRE.has(w.split(/[\s-]/)[0]);
}

function enArticle(word: string): string {
	const w = word.toLowerCase();
	if (/^(hour|honest|honou?r|heir)/.test(w)) return 'an';
	if (/^(uni|use|usu|eu|one|once|ur[aeiou])/.test(w)) return 'a';
	return /^[aeiou]/.test(w) ? 'an' : 'a';
}

function itArticle(word: string, gender: Gender): string {
	if (VOWEL.test(word)) return "l'";
	if (gender === 'f') return 'la ';
	return /^(s[^aeiou]|z|gn|ps|pn|x|y)/i.test(word) ? 'lo ' : 'il ';
}

/** The main answer including article (nouns) or particle ("to" for English verbs). */
export function buildMainAnswer(lang: string, word: string, pos: Pos, gender?: Gender): string {
	if (lang === 'en') {
		if (pos === 'noun') return `${enArticle(word)} ${word}`;
		if (pos === 'verb') return word.startsWith('to ') ? word : `to ${word}`;
		return word;
	}
	if (pos !== 'noun' || !gender || gender === 'mf') return word;
	switch (lang) {
		case 'fr':
			if (frElides(word)) return `l'${word}`;
			return `${gender === 'f' ? 'la' : 'le'} ${word}`;
		case 'es':
			return `${gender === 'f' ? 'la' : 'el'} ${word}`;
		case 'it':
			return `${itArticle(word, gender)}${word}`;
		case 'pt':
			return `${gender === 'f' ? 'a' : 'o'} ${word}`;
		case 'nl':
			return `${gender === 'n' ? 'het' : 'de'} ${word}`;
		default:
			return word;
	}
}

function pluralWithArticle(lang: string, plural: string, gender?: Gender): string {
	switch (lang) {
		case 'fr':
			return `les ${plural}`;
		case 'es':
			return gender === 'f' ? `las ${plural}` : gender === 'm' ? `los ${plural}` : plural;
		case 'it':
			if (gender === 'f') return `le ${plural}`;
			if (gender === 'm') return /^([aeiou]|s[^aeiou]|z|gn|ps|x|y)/i.test(plural) ? `gli ${plural}` : `i ${plural}`;
			return plural;
		case 'pt':
			return gender === 'f' ? `as ${plural}` : gender === 'm' ? `os ${plural}` : plural;
		case 'nl':
			return `de ${plural}`;
		default:
			return plural;
	}
}

const GERMAN_PRONOUNS: Record<string, string> = {
	'1S': 'ich',
	'2S': 'du',
	'3S': 'er/sie/es',
	'1P': 'wir',
	'2P': 'ihr',
	'3P': 'sie (Plural)'
};

const FR_PRONOUNS: Record<string, string> = {
	'1S': 'je',
	'2S': 'tu',
	'3S': 'il',
	'1P': 'nous',
	'2P': 'vous',
	'3P': 'ils'
};

function frWithPronoun(person: string, form: string): string {
	const p = FR_PRONOUNS[person];
	return p === 'je' && frElides(form) ? `j'${form}` : `${p} ${form}`;
}

const KIND_LABELS: Record<string, string> = {
	plural: 'Plural',
	past: 'Vergangenheit',
	participle: 'Partizip Perfekt',
	participleFem: 'Partizip Perfekt (weiblich)',
	participleMascPl: 'Partizip Perfekt (männlich Plural)',
	participleFemPl: 'Partizip Perfekt (weiblich Plural)',
	ing: 'Verlaufsform (-ing)',
	pastHistoric: 'Passato remoto: ich',
	comparative: 'Komparativ',
	superlative: 'Superlativ',
	mascSg: 'männlich Singular',
	fem: 'weiblich Singular',
	mascPl: 'männlich Plural',
	femPl: 'weiblich Plural'
};

const TENSE_LABELS: Record<string, string> = {
	present: 'Präsens',
	past: 'Vergangenheit',
	imperfect: 'Imperfekt',
	subjunctive2: 'Konjunktiv II',
	imperative: 'Imperativ'
};

/** Translates one overview-table form into a German label + answer. */
function describeForm(lang: string, k: FormKind, key: string, value: string, entry: ForeignEntry): FormCandidate {
	if (k.person && TENSE_LABELS[k.kind] && k.kind !== 'past') {
		const answer = lang === 'fr' && k.kind === 'present' ? frWithPronoun(k.person, value) : value;
		return { label: `${TENSE_LABELS[k.kind]}: ${GERMAN_PRONOUNS[k.person]}`, answer };
	}
	if (k.kind === 'plural') return { label: 'Plural', answer: pluralWithArticle(lang, value, entry.gender) };
	return { label: KIND_LABELS[k.kind] ?? key.replace(/_/g, ' – '), answer: value };
}

/**
 * The special forms the user can choose from, in table order. Only forms
 * that are NOT built by the language's standard rule are offered (roof →
 * roofs is left out, child → children is offered). Alternatives like
 * "beau / bel" use the first spelling; forms equal to the main word are dropped.
 */
export function buildFormCandidates(
	lang: string,
	word: string,
	entry: ForeignEntry,
	german?: { word: string; table: Map<string, string> }
): FormCandidate[] {
	const withPrompt = (c: FormCandidate, k: FormKind): FormCandidate => {
		const prompt = german && germanPrompt(k, german.table, german.word, entry.pos);
		return prompt ? { ...c, prompt } : c;
	};
	const forms = entry.forms
		.map((f) => ({ key: f.key, value: f.value.split(/\s*\/\s*/)[0].trim(), kind: formKind(f.key, entry.pos) }))
		.filter((f) => f.value);
	const byKind = new Map(forms.map((f) => [f.kind.kind + (f.kind.person ?? ''), f.value]));
	const result: FormCandidate[] = [];
	const seen = new Set<string>();
	const add = (c: FormCandidate) => {
		if (!c.answer || seen.has(c.label + '|' + c.answer)) return;
		seen.add(c.label + '|' + c.answer);
		result.push(c);
	};
	for (const f of forms) {
		if (f.value === word) continue;
		if (isStandardForm(lang, entry.pos, word, f.kind, f.value, byKind)) continue;
		add(withPrompt(describeForm(lang, f.kind, f.key, f.value, entry), f.kind));
	}
	if (lang === 'fr' && entry.pos === 'verb' && entry.auxiliary) {
		const participle = byKind.get('participle');
		if (participle) {
			const withEtre = entry.auxiliary.startsWith('ê');
			const standard = !withEtre && isStandardForm('fr', 'verb', word, { kind: 'participle' }, participle);
			if (!standard)
				add(withPrompt({ label: 'Passé composé: er/sie/es', answer: `il ${withEtre ? 'est' : 'a'} ${participle}` }, { kind: 'perfect3S' }));
		}
	}
	return result;
}
