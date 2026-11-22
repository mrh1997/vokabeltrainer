/**
 * Joins single-word recordings into one ("le" + "chien" → "le chien"):
 * cuts the silence around each word, evens out their loudness and stores
 * the result as a WAV file, so playback needs no speech voice on the device.
 */

/** Sample rate of joined recordings; plenty for speech and keeps files small. */
export const RATE = 24000;
/** Pause between two words. */
const GAP_S = 0.04;
/** Silence kept before and after each word, and fade length against clicks. */
const PAD_S = 0.01;
const FADE_S = 0.005;

/** The part of `samples` that is louder than a small share of its peak, plus a little padding. */
export function trimSilence(samples: Float32Array, rate: number): Float32Array {
	let peak = 0;
	for (const v of samples) peak = Math.max(peak, Math.abs(v));
	if (peak === 0) return new Float32Array(0);
	const threshold = peak * 0.04;
	let s = 0;
	let e = samples.length - 1;
	while (s < e && Math.abs(samples[s]) < threshold) s++;
	while (e > s && Math.abs(samples[e]) < threshold) e--;
	const pad = Math.round(rate * PAD_S);
	return samples.slice(Math.max(0, s - pad), Math.min(samples.length, e + 1 + pad));
}

/** Trimmed, equally loud words with short pauses between them, as one track. */
export function joinWords(words: Float32Array[], rate: number): Float32Array {
	const clips = words.map((w) => trimSilence(w, rate)).filter((c) => c.length);
	const gap = Math.round(rate * GAP_S);
	const fade = Math.round(rate * FADE_S);
	const out = new Float32Array(clips.reduce((n, c) => n + c.length, 0) + gap * Math.max(0, clips.length - 1));
	let pos = 0;
	for (const clip of clips) {
		let peak = 0;
		for (const v of clip) peak = Math.max(peak, Math.abs(v));
		const gain = 0.9 / peak;
		for (let i = 0; i < clip.length; i++) {
			const edge = Math.min(1, i / fade, (clip.length - 1 - i) / fade);
			out[pos + i] = clip[i] * gain * edge;
		}
		pos += clip.length + gap;
	}
	return out;
}

/** 16-bit mono PCM WAV file. */
export function encodeWav(samples: Float32Array, rate: number): Blob {
	const buf = new ArrayBuffer(44 + samples.length * 2);
	const v = new DataView(buf);
	const text = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
	text(0, 'RIFF');
	v.setUint32(4, 36 + samples.length * 2, true);
	text(8, 'WAVE');
	text(12, 'fmt ');
	v.setUint32(16, 16, true);
	v.setUint16(20, 1, true); // PCM
	v.setUint16(22, 1, true); // mono
	v.setUint32(24, rate, true);
	v.setUint32(28, rate * 2, true);
	v.setUint16(32, 2, true);
	v.setUint16(34, 16, true);
	text(36, 'data');
	v.setUint32(40, samples.length * 2, true);
	samples.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true));
	return new Blob([buf], { type: 'audio/wav' });
}

/** Decodes recordings (mp3) with the browser and joins them into one WAV file. */
export async function combineRecordings(blobs: Blob[]): Promise<Blob> {
	const ctx = new OfflineAudioContext(1, 1, RATE);
	const decoded = await Promise.all(blobs.map(async (b) => ctx.decodeAudioData(await b.arrayBuffer())));
	return encodeWav(joinWords(decoded.map((d) => d.getChannelData(0)), RATE), RATE);
}
