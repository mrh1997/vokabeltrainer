/**
 * Decides whether an English noun is learned with "a"/"an" ("a house") or
 * without an article, as with names ("Monday", "Germany"), uncountable nouns
 * ("advice") and plurals ("scissors").
 *
 * The dictionary marks only some uncountable nouns ("information" has no
 * plural there, but "advice" does), so common ones are listed here as well.
 */

/** What is known about an English noun besides its spelling. */
export interface NounFacts {
	/** According to the dictionary the noun exists only in the singular or only in the plural. */
	number?: 'singularOnly' | 'pluralOnly';
	/** The German word denotes a person (Italiener, not Italienisch): "an Italian", but the language "Italian". */
	person?: boolean;
}

/** Nouns used without "a"/"an" in their usual meaning, also at the end of compounds ("mineral water"). */
const NO_ARTICLE = new Set(
	`
	monday tuesday wednesday thursday friday saturday sunday
	january february april june july september october november december
	christmas easter halloween

	water milk juice tea coffee wine beer alcohol bread butter cheese sugar salt pepper flour rice pasta meat beef pork
	bacon ham honey jam chocolate garlic food oil toast cereal yoghurt yogurt cream spaghetti ketchup mustard vinegar
	breakfast lunch dinner supper
	air rain snow ice sand grass weather fog sunshine lightning thunder smoke dust dirt mud soil
	gold silver steel copper plastic wood wool cotton leather silk petrol gasoline gas electricity soap shampoo toothpaste
	paint ink cement concrete rubbish garbage trash litter

	advice information news knowledge evidence research progress homework housework work money cash
	furniture equipment luggage baggage clothing jewellery jewelry underwear software hardware traffic transport
	transportation accommodation music art literature poetry history geography chemistry biology mathematics maths math
	physics politics economics athletics gymnastics internet
	love hate happiness sadness anger fear courage patience luck fun health hunger thirst peace freedom
	justice truth childhood death nature time energy blood hair skin sleep
	education employment unemployment poverty wealth pollution violence help permission behaviour behavior trouble
	fame respect trust honesty laughter sunlight daylight darkness
	football soccer tennis basketball volleyball handball baseball hockey golf rugby cricket badminton chess
	swimming cycling shopping skiing sailing dancing cooking jogging camping fishing
	red blue green yellow black brown grey gray pink purple

	people police clothes jeans trousers pants shorts tights leggings pyjamas pajamas knickers scissors glasses sunglasses
	spectacles binoculars tongs pliers tweezers headphones goods thanks parents grandparents outskirts surroundings
	savings earnings contents stairs cattle vegetables sweets groceries holidays
	`
		.trim()
		.split(/\s+/)
);

/** Names written in capitals; other abbreviations are ordinary nouns ("a CD"). */
const NAME_ABBREVIATIONS = new Set(['USA', 'US', 'UK', 'EU', 'UN', 'UNO', 'NATO', 'NASA', 'GDR', 'FRG', 'USSR']);

/** Names: a capital letter ("Monday"), but not "T-shirt" or "CD". */
function isName(head: string): boolean {
	return NAME_ABBREVIATIONS.has(head) || (/^\p{Lu}/u.test(head) && !/^\p{Lu}(-|\p{Lu}|\d|$)/u.test(head));
}

/** True if the noun is learned without "a"/"an". */
export function withoutArticle(noun: string, facts: NounFacts = {}): boolean {
	if (/^(a|an|the)\s/i.test(noun)) return true; // "the Netherlands" has its article already
	if (facts.number === 'pluralOnly') return true;
	// the noun that decides: "piece of furniture" → piece, "Christmas tree" → tree
	const head = noun.split(/\s+of\s+/)[0].split(/\s+/).at(-1)!;
	if (isName(head)) return !facts.person;
	return facts.number === 'singularOnly' || NO_ARTICLE.has(head.toLowerCase());
}
