/**
 * The German counterpart of a special form, shown as the quiz prompt:
 * "ich gehe" for "je vais", "er ist gegangen" for "il est allé",
 * "die Häuser" for "les maisons". Built from the German word's own
 * inflection table on German Wiktionary.
 */
import type { FormKind } from './regular';
import type { Gender, Pos } from './wikitext';

const first = (v: string | undefined) => v?.split(/\s*[,/]\s*/)[0].trim() || undefined;

/** "ihr"-form of the present tense: stem + t (gehen → geht, arbeiten → arbeitet, sammeln → sammelt). */
function ihrForm(infinitive: string): string {
	if (infinitive === 'sein') return 'seid';
	const stem = infinitive.replace(/e?n$/, '');
	return /[dt]$/.test(stem) || /[^aeioulrh][mn]$/.test(stem) ? stem + 'et' : stem + 't';
}

/**
 * German prompt for one special form, or undefined if the German table
 * lacks the needed form (the caller then falls back to a descriptive label).
 * `de` holds the German word's inflection table, `word` the German word.
 * `withArticle`: the answer carries an article ("les chevaux" → "die Pferde",
 * but "mice" → "Mäuse").
 */
export function germanPrompt(k: FormKind, de: Map<string, string>, word: string, pos: Pos, withArticle = true): string | undefined {
	if (pos === 'verb') {
		const pronounForm = (pronoun: string, form: string | undefined) => (form ? `${pronoun} ${form}` : undefined);
		switch (k.kind) {
			case 'present':
				switch (k.person) {
					case '1S':
						return pronounForm('ich', first(de.get('Präsens_ich')));
					case '2S':
						return pronounForm('du', first(de.get('Präsens_du')));
					case '3S':
						return pronounForm('er', first(de.get('Präsens_er, sie, es')));
					case '1P':
						return `wir ${word}`;
					case '2P':
						return `ihr ${ihrForm(word)}`;
					case '3P':
						return `sie ${word}`;
				}
				return undefined;
			case 'past':
				return pronounForm('ich', first(de.get('Präteritum_ich')));
			case 'imperfect': {
				const p = pronounForm('ich', first(de.get('Präteritum_ich')));
				return p && `${p} (Imperfekt)`;
			}
			case 'pastHistoric': {
				const p = pronounForm('ich', first(de.get('Präteritum_ich')));
				return p && `${p} (Passato remoto)`;
			}
			case 'subjunctive2':
				return pronounForm('ich', first(de.get('Konjunktiv II_ich')));
			case 'imperative': {
				const f = first(de.get(k.person === '2P' ? 'Imperativ Plural' : 'Imperativ Singular'));
				return f && `${f}!${k.person === '2P' ? ' (ihr)' : ''}`;
			}
			case 'participle':
				return first(de.get('Partizip II'));
			case 'participleFem':
			case 'participleMascPl':
			case 'participleFemPl': {
				const p = first(de.get('Partizip II'));
				const which = { participleFem: 'weiblich', participleMascPl: 'männlich Plural', participleFemPl: 'weiblich Plural' }[k.kind];
				return p && `${p} (${which})`;
			}
			case 'ing':
				return `${word}d`;
			case 'perfect3S': {
				const p = first(de.get('Partizip II'));
				const aux = de.get('Hilfsverb')?.startsWith('sein') ? 'ist' : 'hat';
				return p && `er ${aux} ${p}`;
			}
		}
		return undefined;
	}
	if (pos === 'noun' && k.kind === 'plural') {
		const plural = first(de.get('Nominativ Plural') ?? de.get('Nominativ Plural 1'));
		return plural && (withArticle ? `die ${plural}` : plural);
	}
	if (pos === 'adj') {
		switch (k.kind) {
			case 'comparative':
				return first(de.get('Komparativ'));
			case 'superlative': {
				const s = first(de.get('Superlativ'));
				return s && `am ${s}`;
			}
			case 'fem':
				return `${word} (weiblich)`;
			case 'mascPl':
				return `${word} (männlich Plural)`;
			case 'femPl':
				return `${word} (weiblich Plural)`;
		}
	}
	return undefined;
}

/**
 * Quiz prompt of a main noun card whose answer carries an article: the German
 * word with the matching article, definite ("der Hund" for "le chien") or, for
 * English, indefinite ("ein Hund" for "a dog"). Undefined if the answer has no
 * article or the German gender is unknown or ambiguous.
 */
export function germanMainPrompt(
	lang: string,
	german: string,
	pos: Pos,
	word: string,
	answer: string,
	germanGender: Gender | undefined
): string | undefined {
	if (pos !== 'noun' || answer === word) return undefined;
	if (germanGender !== 'm' && germanGender !== 'f' && germanGender !== 'n') return undefined;
	const article = lang === 'en' ? { m: 'ein', f: 'eine', n: 'ein' } : { m: 'der', f: 'die', n: 'das' };
	return `${article[germanGender]} ${german}`;
}
