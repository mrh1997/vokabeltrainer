import { describe, expect, it } from 'vitest';
import { pickVoice } from './index';

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
