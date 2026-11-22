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
 * "Fr-une bête.ogg" does not count as a recording of "bête".
 */
export function recordingSays(file: string, text: string): boolean {
	const t = text.toLowerCase().trim();
	return spokenName(file)
		.split('-')
		.some((part) => part.trim() === t);
}
