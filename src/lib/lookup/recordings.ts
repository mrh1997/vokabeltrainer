/** Matching Commons recordings to the text a learner has to type. */

/** Text spoken in a Commons recording, from its file name ("En-uk-to go.ogg" → "en-uk-to go"). */
export function spokenName(file: string): string {
	return file.replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' ').toLowerCase();
}

/**
 * True if the recording says exactly `text`. File names consist of
 * "-"-separated parts (language, region, speaker, spoken text), e.g.
 * "Fr-chien.ogg", "En-uk-to go.ogg", "LL-Q150 (fra)-Yug-aller.wav",
 * "En-us-inlandnorth-gut.ogg". One part must equal the text, so
 * "Fr-une bête.ogg" does not count as a recording of "bête". Texts that
 * contain "-" themselves ("peut-être") must end the name.
 */
export function recordingSays(file: string, text: string): boolean {
	const t = text.toLowerCase().trim();
	const name = spokenName(file);
	return name.endsWith(`-${t}`) || name.split('-').some((part) => part.trim() === t);
}

/** Speaker of a Lingua Libre recording ("LL-Q150 (fra)-Yug-aller.wav", "aller" → "yug"). */
export function linguaLibreSpeaker(file: string, text: string): string | undefined {
	const name = spokenName(file);
	const suffix = `-${text.toLowerCase().trim()}`;
	if (!name.startsWith('ll-') || !name.endsWith(suffix)) return undefined;
	return name.slice(0, -suffix.length).replace(/^ll-q\d+ \([a-z]+\)-/, '');
}

/**
 * The words of an answer, each spoken by its own recording when no
 * recording of the whole answer exists ("le chien" → ["le", "chien"]).
 * Elided forms stay one word ("l'arbre", "j'ai").
 */
export function spokenWords(answer: string): string[] {
	return answer
		.split(/\s+/)
		.map((w) => w.replace(/^[¿¡«»"„“”()]+|[?!.,;:«»"„“”()]+$/g, ''))
		.filter(Boolean);
}

/**
 * Some recordings say more than their name: "Fr-chien.ogg" is described as
 * "Pronunciation of "chien" (un chien)". True if a file description shows
 * such a longer phrase containing `text` in parentheses.
 */
export function descriptionAddsWords(description: string, text: string): boolean {
	const t = text.toLowerCase().trim();
	for (const m of description.toLowerCase().matchAll(/\(([^()]*)\)/g)) {
		const inner = m[1].trim();
		if (inner !== t && new RegExp(`(^|[\\s'’])${escapeRegExp(t)}($|[\\s,.;!?])`).test(inner)) return true;
	}
	return false;
}

export function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}
