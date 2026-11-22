/**
 * Pronunciation playback: the stored recording if there is one, else one
 * fetched now (online), otherwise the device's built-in speech synthesis
 * in the card's language.
 */
import { getAudio, getCard, type Card } from '#lib/db/index.ts';
import { findLanguage } from '#lib/languages.ts';
import { audioFits, ensureAudio } from './pronunciation';
import { voiceStatus } from './voice-status.svelte.ts';

let current: HTMLAudioElement | undefined;
let currentUrl: string | undefined;

function stop() {
	current?.pause();
	if (currentUrl) URL.revokeObjectURL(currentUrl);
	current = currentUrl = undefined;
	if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

/** The browser loads its voice list asynchronously; wait for it (at most ~1.5 s). */
async function voices(): Promise<SpeechSynthesisVoice[]> {
	let list = speechSynthesis.getVoices();
	if (list.length) return list;
	await new Promise<void>((resolve) => {
		const done = () => resolve();
		speechSynthesis.addEventListener('voiceschanged', done, { once: true });
		setTimeout(done, 1500);
	});
	return speechSynthesis.getVoices();
}

/** Best voice for a BCP-47 tag like "fr-FR": exact region first, then any of the language. */
export function pickVoice(list: SpeechSynthesisVoice[], tag: string): SpeechSynthesisVoice | undefined {
	const norm = (s: string) => s.toLowerCase().replace('_', '-');
	const want = norm(tag);
	const base = want.split('-')[0];
	const sameLang = list.filter((v) => norm(v.lang).split('-')[0] === base);
	return sameLang.find((v) => norm(v.lang) === want && v.localService) ?? sameLang.find((v) => norm(v.lang) === want) ?? sameLang[0];
}

/**
 * Speaks `text` with a voice of the card's language. If the device has no
 * such voice nothing is spoken (a German voice reading French sounds wrong)
 * and `voiceStatus.missing` tells the UI to show a hint.
 */
export async function speak(text: string, lang: string): Promise<void> {
	if (typeof speechSynthesis === 'undefined') return;
	const tag = findLanguage(lang)?.speech ?? lang;
	const voice = pickVoice(await voices(), tag);
	if (!voice) {
		voiceStatus.missing = findLanguage(lang)?.name ?? lang;
		return;
	}
	const u = new SpeechSynthesisUtterance(text);
	u.lang = voice.lang;
	u.voice = voice;
	speechSynthesis.cancel();
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
 * A recording is only used if it says the whole answer: for "le chien" a
 * recording of just "chien" is skipped. A card without one gets it now if
 * the device is online (whole-answer or joined word recordings); speech
 * synthesis is the last resort.
 */
export async function playCard(card: Card): Promise<void> {
	try {
		// The stored card may already have a recording the caller's copy lacks.
		const fresh = (await getCard(card.id).catch(() => undefined)) ?? card;
		let blob = audioFits(fresh) ? await getAudio(fresh.audioId!) : undefined;
		blob ??= await ensureAudio(fresh, false, AbortSignal.timeout(6000));
		if (blob) {
			await playBlob(blob);
			return;
		}
	} catch {
		// fall through to speech synthesis
	}
	stop();
	await speak(card.answer, card.lang);
}
