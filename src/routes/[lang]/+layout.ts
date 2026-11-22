import { error } from '@sveltejs/kit';
import { findLanguage } from '#lib/languages.ts';

export function load({ params }) {
	const language = findLanguage(params.lang);
	if (!language) error(404, 'Diese Sprache gibt es nicht.');
	return { language };
}
