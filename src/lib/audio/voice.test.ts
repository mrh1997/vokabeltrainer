import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickVoice, pronounce } from './index';

const v = (lang: string, name: string, localService = true) => ({ lang, name, localService }) as SpeechSynthesisVoice;

describe('pickVoice', () => {
	const voices = [v('de-DE', 'Hedda'), v('fr-CA', 'Sylvie'), v('fr-FR', 'Julie', false), v('fr-FR', 'Hortense')];

	it('prefers the exact region and a local voice', () => {
		expect(pickVoice(voices, 'fr-FR')?.name).toBe('Hortense');
	});

	it('falls back to another region of the same language', () => {
		expect(pickVoice([v('de-DE', 'Hedda'), v('fr-CA', 'Sylvie')], 'fr-FR')?.name).toBe('Sylvie');
	});

	it('never picks a voice of a different language', () => {
		expect(pickVoice([v('de-DE', 'Hedda')], 'fr-FR')).toBeUndefined();
	});
});

describe('pronounce', () => {
	function stubSpeech(list: SpeechSynthesisVoice[]) {
		const spoken: string[] = [];
		vi.stubGlobal('speechSynthesis', { getVoices: () => list, cancel() {}, speak: (u: { text: string }) => spoken.push(u.text) });
		vi.stubGlobal(
			'SpeechSynthesisUtterance',
			class {
				lang = '';
				voice: unknown;
				constructor(public text: string) {}
			}
		);
		return spoken;
	}
	afterEach(() => vi.unstubAllGlobals());

	it('uses the device voice and never fetches the recording', async () => {
		const spoken = stubSpeech([v('fr-FR', 'Hortense')]);
		const fallback = vi.fn(async () => undefined);
		await pronounce('le chien', 'fr', fallback);
		expect(spoken).toEqual(['le chien']);
		expect(fallback).not.toHaveBeenCalled();
	});

	it('falls back to the recording without an on-device voice', async () => {
		const spoken = stubSpeech([v('de-DE', 'Hedda'), v('fr-FR', 'Google français', false)]);
		const fallback = vi.fn(async () => undefined);
		await pronounce('le chien', 'fr', fallback);
		expect(fallback).toHaveBeenCalled();
		expect(spoken).toEqual(['le chien']); // no recording either: network voice as last resort
	});
});
