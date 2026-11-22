/**
 * Languages the user can learn. `code` is the language code German Wiktionary
 * uses in its translation tables ({{Ü|fr|…}}); `name` is the German language
 * name it uses in section headings ({{Sprache|Französisch}}).
 * `iso3` is the ISO 639-3 code used in Lingua Libre recording names ("LL-Q150 (fra)-…").
 * `speech` is the BCP-47 tag for the browser's speech synthesis fallback.
 */
export interface Language {
	code: string;
	name: string;
	iso3: string;
	speech: string;
	flag?: string;
}

export const LANGUAGES: Language[] = [
	{ code: 'en', iso3: 'eng', name: 'Englisch', speech: 'en-GB', flag: '🇬🇧' },
	{ code: 'fr', iso3: 'fra', name: 'Französisch', speech: 'fr-FR', flag: '🇫🇷' },
	{ code: 'es', iso3: 'spa', name: 'Spanisch', speech: 'es-ES', flag: '🇪🇸' },
	{ code: 'it', iso3: 'ita', name: 'Italienisch', speech: 'it-IT', flag: '🇮🇹' },
	{ code: 'pt', iso3: 'por', name: 'Portugiesisch', speech: 'pt-PT', flag: '🇵🇹' },
	{ code: 'nl', iso3: 'nld', name: 'Niederländisch', speech: 'nl-NL', flag: '🇳🇱' },
	{ code: 'sv', iso3: 'swe', name: 'Schwedisch', speech: 'sv-SE', flag: '🇸🇪' },
	{ code: 'da', iso3: 'dan', name: 'Dänisch', speech: 'da-DK', flag: '🇩🇰' },
	{ code: 'no', iso3: 'nor', name: 'Norwegisch', speech: 'nb-NO', flag: '🇳🇴' },
	{ code: 'fi', iso3: 'fin', name: 'Finnisch', speech: 'fi-FI', flag: '🇫🇮' },
	{ code: 'is', iso3: 'isl', name: 'Isländisch', speech: 'is-IS', flag: '🇮🇸' },
	{ code: 'pl', iso3: 'pol', name: 'Polnisch', speech: 'pl-PL', flag: '🇵🇱' },
	{ code: 'cs', iso3: 'ces', name: 'Tschechisch', speech: 'cs-CZ', flag: '🇨🇿' },
	{ code: 'sk', iso3: 'slk', name: 'Slowakisch', speech: 'sk-SK', flag: '🇸🇰' },
	{ code: 'hu', iso3: 'hun', name: 'Ungarisch', speech: 'hu-HU', flag: '🇭🇺' },
	{ code: 'ro', iso3: 'ron', name: 'Rumänisch', speech: 'ro-RO', flag: '🇷🇴' },
	{ code: 'bg', iso3: 'bul', name: 'Bulgarisch', speech: 'bg-BG', flag: '🇧🇬' },
	{ code: 'hr', iso3: 'hrv', name: 'Kroatisch', speech: 'hr-HR', flag: '🇭🇷' },
	{ code: 'sr', iso3: 'srp', name: 'Serbisch', speech: 'sr-RS', flag: '🇷🇸' },
	{ code: 'sl', iso3: 'slv', name: 'Slowenisch', speech: 'sl-SI', flag: '🇸🇮' },
	{ code: 'el', iso3: 'ell', name: 'Neugriechisch', speech: 'el-GR', flag: '🇬🇷' },
	{ code: 'ru', iso3: 'rus', name: 'Russisch', speech: 'ru-RU', flag: '🇷🇺' },
	{ code: 'uk', iso3: 'ukr', name: 'Ukrainisch', speech: 'uk-UA', flag: '🇺🇦' },
	{ code: 'tr', iso3: 'tur', name: 'Türkisch', speech: 'tr-TR', flag: '🇹🇷' },
	{ code: 'lt', iso3: 'lit', name: 'Litauisch', speech: 'lt-LT', flag: '🇱🇹' },
	{ code: 'lv', iso3: 'lav', name: 'Lettisch', speech: 'lv-LV', flag: '🇱🇻' },
	{ code: 'et', iso3: 'est', name: 'Estnisch', speech: 'et-EE', flag: '🇪🇪' },
	{ code: 'ca', iso3: 'cat', name: 'Katalanisch', speech: 'ca-ES' },
	{ code: 'gl', iso3: 'glg', name: 'Galicisch', speech: 'gl-ES' },
	{ code: 'eu', iso3: 'eus', name: 'Baskisch', speech: 'eu-ES' },
	{ code: 'ga', iso3: 'gle', name: 'Irisch', speech: 'ga-IE', flag: '🇮🇪' },
	{ code: 'cy', iso3: 'cym', name: 'Walisisch', speech: 'cy-GB' },
	{ code: 'la', iso3: 'lat', name: 'Latein', speech: 'it-IT' },
	{ code: 'eo', iso3: 'epo', name: 'Esperanto', speech: 'eo' },
	{ code: 'ar', iso3: 'ara', name: 'Arabisch', speech: 'ar-SA' },
	{ code: 'he', iso3: 'heb', name: 'Hebräisch', speech: 'he-IL', flag: '🇮🇱' },
	{ code: 'fa', iso3: 'fas', name: 'Persisch', speech: 'fa-IR', flag: '🇮🇷' },
	{ code: 'hi', iso3: 'hin', name: 'Hindi', speech: 'hi-IN', flag: '🇮🇳' },
	{ code: 'zh', iso3: 'cmn', name: 'Chinesisch', speech: 'zh-CN', flag: '🇨🇳' },
	{ code: 'ja', iso3: 'jpn', name: 'Japanisch', speech: 'ja-JP', flag: '🇯🇵' },
	{ code: 'ko', iso3: 'kor', name: 'Koreanisch', speech: 'ko-KR', flag: '🇰🇷' },
	{ code: 'vi', iso3: 'vie', name: 'Vietnamesisch', speech: 'vi-VN', flag: '🇻🇳' },
	{ code: 'th', iso3: 'tha', name: 'Thai', speech: 'th-TH', flag: '🇹🇭' },
	{ code: 'id', iso3: 'ind', name: 'Indonesisch', speech: 'id-ID', flag: '🇮🇩' },
	{ code: 'sw', iso3: 'swa', name: 'Suaheli', speech: 'sw-KE' }
];

export function findLanguage(code: string): Language | undefined {
	return LANGUAGES.find((l) => l.code === code);
}
