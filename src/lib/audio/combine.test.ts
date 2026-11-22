import { describe, expect, it } from 'vitest';
import { encodeWav, joinWords, trimSilence } from './combine';

const RATE = 1000;
/** `silence` ms of zeros around `loud` ms of a tone with amplitude `amp`. */
function word(silence: number, loud: number, amp: number): Float32Array {
	const s = new Float32Array(silence * 2 + loud);
	for (let i = 0; i < loud; i++) s[silence + i] = amp * Math.sin(i);
	return s;
}

describe('trimSilence', () => {
	it('cuts silence but keeps 10 ms of padding', () => {
		const t = trimSilence(word(300, 200, 0.5), RATE);
		expect(t.length).toBeGreaterThanOrEqual(200);
		expect(t.length).toBeLessThanOrEqual(222);
	});

	it('returns nothing for pure silence', () => {
		expect(trimSilence(new Float32Array(100), RATE).length).toBe(0);
	});
});

describe('joinWords', () => {
	it('joins trimmed words with a short pause at equal loudness', () => {
		const out = joinWords([word(300, 100, 0.1), word(500, 200, 0.8)], RATE);
		expect(out.length).toBeLessThan(400); // instead of 1700 with the silence
		const peak = (a: Float32Array) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
		const firstHalf = out.slice(0, 120);
		const secondHalf = out.slice(out.length - 200);
		expect(peak(firstHalf)).toBeCloseTo(peak(secondHalf), 1);
	});
});

describe('encodeWav', () => {
	it('writes a 16-bit mono WAV header', async () => {
		const blob = encodeWav(new Float32Array(10), 24000);
		const v = new DataView(await blob.arrayBuffer());
		expect(blob.type).toBe('audio/wav');
		expect(blob.size).toBe(64);
		expect(String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3))).toBe('RIFF');
		expect(v.getUint32(24, true)).toBe(24000);
	});
});
