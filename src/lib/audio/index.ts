/**
 * Pronunciation playback: the stored recording if there is one, otherwise
 * the device's built-in speech synthesis in the card's language.
 */
import { getAudio } from '#lib/db/index.ts';
import { findLanguage } from '#lib/languages.ts';
import { recordingSays } from '#lib/lookup/recordings.ts';

let current: HTMLAudioElement | undefined;
let currentUrl: string | undefined;

function stop() {
	current?.pause();
	if (currentUrl) URL.revokeObjectURL(currentUrl);
	current = currentUrl = undefined;
	if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

export function speak(text: string, lang: string): void {
	if (typeof speechSynthesis === 'undefined') return;
	const u = new SpeechSynthesisUtterance(text);
	u.lang = findLanguage(lang)?.speech ?? lang;
	const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(u.lang.toLowerCase().slice(0, 2)));
	if (voice) u.voice = voice;
	speechSynthesis.speak(u);
}

export async function playBlob(blob: Blob): Promise<void> {
	stop();
	currentUrl = URL.createObjectURL(blob);
	current = new Audio(currentUrl);
	await current.play();
}

/**
 * Plays a card's pronunciation. Never throws (autoplay restrictions etc.).
 * A recording is only used if it says the whole answer: for "a dog" a
 * recording of just "dog" is skipped in favour of speech synthesis.
 */
export async function playCard(card: { audioId?: string; answer: string; lang: string }): Promise<void> {
	try {
		const fits = card.audioId && (recordingSays(card.audioId, card.answer) || !/[\s']/.test(card.answer));
		const blob = fits ? await getAudio(card.audioId!) : undefined;
		if (blob) {
			await playBlob(blob);
			return;
		}
	} catch {
		// fall through to speech synthesis
	}
	stop();
	speak(card.answer, card.lang);
}
