/** Matching Commons recordings to the text a learner has to type. */

/** Text spoken in a Commons recording, from its file name ("En-uk-to go.ogg" → "en-uk-to go"). */
export function spokenName(file: string): string {
	return file.replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' ').toLowerCase();
}

/** True if the recording says exactly `text` ("Fr-chien.ogg" says "chien"). */
export function recordingSays(file: string, text: string): boolean {
	const name = spokenName(file);
	const t = text.toLowerCase();
	return name === t || name.endsWith(`-${t}`);
}
