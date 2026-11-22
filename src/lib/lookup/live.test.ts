/**
 * Checks against the real Wikimedia APIs. Skipped by default (network, rate
 * limits); run with: LIVE=1 npx vitest run src/lib/lookup/live.test.ts
 */
import { describe, expect, it } from 'vitest';
import { findLanguage } from '#lib/languages.ts';
import { linguaLibreSpeaker, recordingSays } from './recordings';
import { completeGerman, downloadAudio, findRecordings, getDetails, getTranslations } from './index';

// Node has no browser User-Agent; Wikimedia's file servers reject anonymous clients.
const plainFetch = globalThis.fetch;
globalThis.fetch = (input, init = {}) =>
	plainFetch(input, { ...init, headers: { ...(init.headers as Record<string, string>), 'User-Agent': 'Vokabeltrainer-tests/1.0 (https://github.com/mrh1997/vokabeltrainer)' } });

describe.skipIf(!process.env.LIVE)('live lookups', () => {
	const fr = findLanguage('fr')!;
	const en = findLanguage('en')!;

	it('completes, translates and fetches audio', { timeout: 60000 }, async () => {
		expect(await completeGerman('Hau')).toContain('Haus');
		const t = await getTranslations('Haus', fr);
		expect(t[0].word).toBe('maison');
		const d = await getDetails(t[0], fr);
		expect(d.answer).toBe('la maison');
		// a recording of the full answer, or "la" + "maison" — never "maison" alone
		if (d.audioFiles.length === 1) expect(recordingSays(d.audioFiles[0], 'la maison')).toBe(true);
		else expect(d.audioFiles.map((f, i) => recordingSays(f, ['la', 'maison'][i]))).toEqual([true, true]);

		const go = (await getTranslations('gehen', en)).find((x) => x.word === 'go')!;
		const goDetails = await getDetails(go, en);
		expect(goDetails.answer).toBe('to go');
		expect(goDetails.forms.map((f) => f.answer)).toContain('went');
		expect(goDetails.audioFiles).toEqual(['En-uk-to go.ogg']);
		const blob = await downloadAudio(goDetails.audioFiles[0]);
		expect(blob?.type).toBe('audio/mpeg');
		expect(blob!.size).toBeGreaterThan(1000);
	});

	it('joins word recordings by one speaker, skipping mislabelled ones', { timeout: 60000 }, async () => {
		const files = await findRecordings('le chien', fr);
		expect(files).toHaveLength(2);
		expect(recordingSays(files[0], 'le') && recordingSays(files[1], 'chien')).toBe(true);
		expect(linguaLibreSpeaker(files[0], 'le')).toBe(linguaLibreSpeaker(files[1], 'chien'));
		// "Fr-chien.ogg" says "un chien" according to its description
		expect(files).not.toContain('Fr-chien.ogg');
	});
});
