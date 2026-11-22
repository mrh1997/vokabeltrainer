/**
 * Local storage of everything the learner owns, in the browser's IndexedDB:
 * the languages being learned, the cards with their progress, and the
 * pronunciation recordings (so the quiz works offline).
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { nextBox } from '#lib/quiz/index.ts';

export interface Card {
	id: string;
	lang: string;
	/** German word as entered, e.g. "gehen". */
	german: string;
	/** For special forms: German label, e.g. "Vergangenheit". */
	formLabel?: string;
	/** Exact text to type, e.g. "to go" or "went". */
	answer: string;
	/** German meaning the translation was chosen for (display only). */
	meaning?: string;
	/** Main cards: the dictionary word and its type, to look up its forms again later. */
	word?: string;
	pos?: 'noun' | 'verb' | 'adj' | 'other';
	gender?: 'm' | 'f' | 'n' | 'mf';
	/** Main card this special form belongs to. */
	parentId?: string;
	createdAt: number;
	/** Position of a special form below its main card. */
	order?: number;
	box: number;
	asked: number;
	correct: number;
	/** Key into the audio store; absent → speech synthesis. */
	audioId?: string;
}

export interface LanguageEntry {
	code: string;
	addedAt: number;
}

interface AudioEntry {
	id: string;
	blob: Blob;
}

interface Schema extends DBSchema {
	languages: { key: string; value: LanguageEntry };
	cards: { key: string; value: Card; indexes: { byLang: string; byParent: string } };
	audio: { key: string; value: AudioEntry };
}

let dbPromise: Promise<IDBPDatabase<Schema>> | undefined;

function db() {
	dbPromise ??= openDB<Schema>('vokabeltrainer', 1, {
		upgrade(d) {
			d.createObjectStore('languages', { keyPath: 'code' });
			const cards = d.createObjectStore('cards', { keyPath: 'id' });
			cards.createIndex('byLang', 'lang');
			cards.createIndex('byParent', 'parentId');
			d.createObjectStore('audio', { keyPath: 'id' });
		}
	});
	return dbPromise;
}

/** Asks the browser not to evict our data under storage pressure. */
export async function requestPersistence(): Promise<boolean> {
	try {
		if (await navigator.storage?.persisted?.()) return true;
		return (await navigator.storage?.persist?.()) ?? false;
	} catch {
		return false;
	}
}

export async function listLanguages(): Promise<LanguageEntry[]> {
	return (await (await db()).getAll('languages')).sort((a, b) => a.addedAt - b.addedAt);
}

export async function addLanguage(code: string): Promise<void> {
	const d = await db();
	if (!(await d.get('languages', code))) await d.put('languages', { code, addedAt: Date.now() });
}

export async function removeLanguage(code: string): Promise<void> {
	const d = await db();
	for (const c of await d.getAllFromIndex('cards', 'byLang', code)) await deleteCardOnly(d, c);
	await d.delete('languages', code);
}

/** All cards of a language in entry order. */
export async function listCards(lang: string): Promise<Card[]> {
	const cards = await (await db()).getAllFromIndex('cards', 'byLang', lang);
	return cards.sort(
		(a, b) => a.createdAt - b.createdAt || (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0) || (a.order ?? 0) - (b.order ?? 0)
	);
}

export async function countCards(lang: string): Promise<number> {
	return (await db()).countFromIndex('cards', 'byLang', lang);
}

export interface NewWord {
	lang: string;
	german: string;
	answer: string;
	meaning?: string;
	word?: string;
	pos?: Card['pos'];
	gender?: Card['gender'];
	audio?: { id: string; blob: Blob };
	forms: { label: string; answer: string }[];
}

function newCard(base: Omit<Card, 'id' | 'box' | 'asked' | 'correct'>): Card {
	return { id: crypto.randomUUID(), box: 1, asked: 0, correct: 0, ...base };
}

/** Saves a word and the chosen special forms as separate cards. Returns the main card. */
export async function addWord(w: NewWord): Promise<Card> {
	const d = await db();
	const createdAt = Date.now();
	const tx = d.transaction(['cards', 'audio', 'languages'], 'readwrite');
	if (w.audio) await tx.objectStore('audio').put(w.audio);
	const main = newCard({
		lang: w.lang,
		german: w.german,
		answer: w.answer,
		meaning: w.meaning,
		word: w.word,
		pos: w.pos,
		gender: w.gender,
		createdAt,
		audioId: w.audio?.id
	});
	await tx.objectStore('cards').put(main);
	for (const [order, f] of w.forms.entries()) {
		await tx.objectStore('cards').put(
			newCard({ lang: w.lang, german: w.german, formLabel: f.label, answer: f.answer, parentId: main.id, createdAt, order })
		);
	}
	if (!(await tx.objectStore('languages').get(w.lang))) await tx.objectStore('languages').put({ code: w.lang, addedAt: createdAt });
	await tx.done;
	return main;
}

/**
 * Makes the special forms of a main card match `forms`: missing ones are
 * added (box 1), unticked ones removed, kept ones keep their progress.
 */
export async function setForms(main: Card, forms: { label: string; answer: string }[]): Promise<void> {
	const d = await db();
	const existing = await d.getAllFromIndex('cards', 'byParent', main.id);
	const key = (f: { label?: string; formLabel?: string; answer: string }) => `${f.formLabel ?? f.label}|${f.answer}`;
	const wanted = new Set(forms.map(key));
	const tx = d.transaction('cards', 'readwrite');
	for (const c of existing) if (!wanted.has(key(c))) await tx.store.delete(c.id);
	for (const [order, f] of forms.entries()) {
		const kept = existing.find((c) => key(c) === key(f));
		if (kept) {
			if (kept.order !== order) await tx.store.put({ ...kept, order });
			continue;
		}
		await tx.store.put(
			newCard({ lang: main.lang, german: main.german, formLabel: f.label, answer: f.answer, parentId: main.id, createdAt: main.createdAt, order })
		);
	}
	await tx.done;
}

async function deleteCardOnly(d: IDBPDatabase<Schema>, card: Card) {
	await d.delete('cards', card.id);
	if (card.audioId) {
		// Remove the recording when no other card uses it.
		const users = (await d.getAll('cards')).filter((c) => c.audioId === card.audioId);
		if (users.length === 0) await d.delete('audio', card.audioId);
	}
}

/** Deletes a card; deleting a main card also deletes its special forms. */
export async function deleteCard(card: Card): Promise<void> {
	const d = await db();
	for (const child of await d.getAllFromIndex('cards', 'byParent', card.id)) await deleteCardOnly(d, child);
	await deleteCardOnly(d, card);
}

/** Applies the box rules after an answer and returns the updated card. */
export async function recordAnswer(card: Card, correct: boolean): Promise<Card> {
	const updated: Card = {
		...card,
		box: nextBox(card.box, correct),
		asked: card.asked + 1,
		correct: card.correct + (correct ? 1 : 0)
	};
	await (await db()).put('cards', updated);
	return updated;
}

export async function getAudio(id: string): Promise<Blob | undefined> {
	return (await (await db()).get('audio', id))?.blob;
}

// ---------- Backup ----------

interface BackupFile {
	app: 'vokabeltrainer';
	version: 1;
	exportedAt: string;
	languages: LanguageEntry[];
	cards: Card[];
	audio: { id: string; type: string; data: string }[];
}

function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const r = new FileReader();
		r.onload = () => resolve((r.result as string).split(',')[1] ?? '');
		r.onerror = () => reject(r.error);
		r.readAsDataURL(blob);
	});
}

function base64ToBlob(data: string, type: string): Blob {
	const bin = atob(data);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return new Blob([bytes], { type });
}

/** Everything (including recordings) as one JSON file. */
export async function exportBackup(): Promise<Blob> {
	const d = await db();
	const audio = await Promise.all(
		(await d.getAll('audio')).map(async (a) => ({ id: a.id, type: a.blob.type || 'audio/mpeg', data: await blobToBase64(a.blob) }))
	);
	const file: BackupFile = {
		app: 'vokabeltrainer',
		version: 1,
		exportedAt: new Date().toISOString(),
		languages: await d.getAll('languages'),
		cards: await d.getAll('cards'),
		audio
	};
	return new Blob([JSON.stringify(file)], { type: 'application/json' });
}

/** Restores a backup. Cards with the same id are overwritten, others are kept. Returns the number of cards read. */
export async function importBackup(text: string): Promise<number> {
	const file = JSON.parse(text) as BackupFile;
	if (file.app !== 'vokabeltrainer' || !Array.isArray(file.cards)) throw new Error('Keine gültige Sicherungsdatei.');
	const d = await db();
	const tx = d.transaction(['languages', 'cards', 'audio'], 'readwrite');
	for (const l of file.languages ?? []) await tx.objectStore('languages').put(l);
	for (const c of file.cards) await tx.objectStore('cards').put(c);
	for (const a of file.audio ?? []) await tx.objectStore('audio').put({ id: a.id, blob: base64ToBlob(a.data, a.type) });
	await tx.done;
	return file.cards.length;
}
