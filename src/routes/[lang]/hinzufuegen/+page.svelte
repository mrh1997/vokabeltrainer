<!--
	Adding vocabulary:
	1. German word with completion → Enter
	2. choose a translation (arrows / typing) → Enter: pronunciation plays
	3. if the word has special forms: tick the ones to learn → Enter
	The list below shows every card of this language, grouped by week.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import Suggest, { type SuggestItem } from '#lib/components/Suggest.svelte';
	import FormPicker from '#lib/components/FormPicker.svelte';
	import WordList from '#lib/components/WordList.svelte';
	import { addWord, deleteCard, listCards, setForms, type Card } from '#lib/db/index.ts';
	import {
		completeGerman,
		getDetails,
		getTranslations,
		type FormCandidate,
		type Translation,
		type WordDetails
	} from '#lib/lookup/index.ts';
	import { playCard, pronounce } from '#lib/audio/index.ts';
	import { fetchPronunciation, fillMissingAudio } from '#lib/audio/pronunciation.ts';
	import { connection } from '#lib/online.svelte.ts';
	import { addMissingPrompts } from '#lib/upgrade.ts';

	let { data } = $props();
	const lang = $derived(data.language);

	let cards = $state<Card[]>([]);

	// Step 1: German word
	let german = $state('');
	let germanInput = $state<HTMLInputElement>();
	let completions = $state<string[]>([]);
	let completing = $state(false);
	let completionTimer: ReturnType<typeof setTimeout> | undefined;
	let completionAbort: AbortController | undefined;

	// Step 2: translation
	let chosenGerman = $state('');
	let translations = $state<Translation[]>([]);
	let loadingTranslations = $state(false);
	let foreign = $state('');
	let foreignInput = $state<HTMLInputElement>();

	// Step 3: special forms
	let pending = $state<{ translation: Translation; details: WordDetails; audio?: { id: string; blob: Blob } } | null>(null);
	let editing = $state<{ card: Card; forms: FormCandidate[]; initial: FormCandidate[] } | null>(null);

	let busy = $state(false);
	let error = $state('');
	let notice = $state('');

	async function reload() {
		cards = await listCards(lang.code);
	}

	$effect(() => {
		lang.code;
		reload().then(async () => {
			if (await addMissingPrompts(lang)) await reload();
			fillMissingAudio(lang.code);
		});
	});

	$effect(() => {
		germanInput?.focus();
	});

	// ---------- Step 1 ----------

	function onGermanInput(value: string) {
		clearTimeout(completionTimer);
		completionAbort?.abort();
		chosenGerman = '';
		translations = [];
		foreign = '';
		error = '';
		if (!value.trim()) {
			completions = [];
			return;
		}
		completing = true;
		completionTimer = setTimeout(async () => {
			completionAbort = new AbortController();
			try {
				completions = await completeGerman(value, completionAbort.signal);
			} catch (e) {
				if ((e as Error).name !== 'AbortError') error = (e as Error).message;
			} finally {
				completing = false;
			}
		}, 220);
	}

	const germanItems = $derived<SuggestItem[]>(completions.map((c) => ({ key: c, primary: c })));

	async function pickGerman(item: SuggestItem | null) {
		const word = (item?.primary ?? german).trim();
		if (!word) return;
		clearTimeout(completionTimer);
		completionAbort?.abort();
		completing = false;
		german = word;
		completions = [];
		chosenGerman = word;
		loadingTranslations = true;
		error = '';
		translations = [];
		foreign = '';
		await tick();
		foreignInput?.focus();
		try {
			translations = await getTranslations(word, lang);
			if (translations.length === 0) error = `Keine Übersetzung von „${word}“ auf ${lang.name} gefunden. Du kannst trotzdem eine eigene eingeben.`;
		} catch (e) {
			error = (e as Error).message;
		} finally {
			loadingTranslations = false;
		}
	}

	// ---------- Step 2 ----------

	const translationItems = $derived.by<SuggestItem[]>(() => {
		const q = foreign.trim().toLowerCase();
		return translations
			.map((t, i) => ({ t, i }))
			.filter(({ t }) => !q || t.word.toLowerCase().includes(q))
			.map(({ t, i }) => ({
				key: String(i),
				primary: t.word + (t.translit ? ` (${t.translit})` : ''),
				secondary: [genderLabel(t.gender), t.meaning].filter(Boolean).join(' · ')
			}));
	});

	function genderLabel(g: Translation['gender']) {
		return g === 'm' ? 'männlich' : g === 'f' ? 'weiblich' : g === 'n' ? 'sächlich' : '';
	}

	async function pickTranslation(item: SuggestItem | null) {
		if (busy || !chosenGerman) return;
		let t: Translation | undefined = item ? translations[Number(item.key)] : undefined;
		if (!t) {
			const typed = foreign.trim();
			if (!typed) return;
			t = translations.find((x) => x.word === typed) ?? { word: typed, pos: translations[0]?.pos ?? 'other' };
		}
		busy = true;
		error = '';
		try {
			const details = await getDetails(t, lang, chosenGerman);
			const fetching = fetchPronunciation(details.answer, lang, details.audioFiles);
			pronounce(details.answer, lang.code, async () => (await fetching)?.blob);
			const audio = await fetching;
			if (details.forms.length) {
				pending = { translation: t, details, audio };
			} else {
				await save(t, details, audio, []);
			}
		} catch (e) {
			error = (e as Error).message;
		} finally {
			busy = false;
		}
	}

	// ---------- Step 3 / saving ----------

	async function save(t: Translation, details: WordDetails, audio: { id: string; blob: Blob } | undefined, forms: FormCandidate[]) {
		const { main, existed } = await addWord({
			lang: lang.code,
			german: chosenGerman,
			answer: details.answer,
			meaning: t.meaning,
			word: t.word,
			pos: details.pos,
			gender: details.gender,
			// a plain copy: pending state is a Svelte proxy, which IndexedDB cannot store
			audio: audio && { id: audio.id, blob: audio.blob },
			forms
		});
		const formsText = forms.length ? ` (+${forms.length} ${forms.length === 1 ? 'Form' : 'Formen'})` : '';
		notice = existed
			? `„${chosenGerman}“ → „${main.answer}“ war schon vorhanden: wieder vorne und in Fach 1${formsText}.`
			: `„${chosenGerman}“ → „${main.answer}“ hinzugefügt${formsText}.`;
		pending = null;
		german = '';
		chosenGerman = '';
		foreign = '';
		translations = [];
		// focus first: the user may already type the next word while the list reloads
		await tick();
		germanInput?.focus();
		germanInput?.scrollIntoView({ block: 'nearest' });
		await reload();
		// recordings for the new special forms, so the quiz has them offline
		fillMissingAudio(lang.code);
	}

	async function confirmForms(chosen: FormCandidate[]) {
		if (!pending) return;
		await save(pending.translation, pending.details, pending.audio, chosen);
	}

	async function cancelForms() {
		pending = null;
		await tick();
		foreignInput?.focus();
	}

	// ---------- List actions ----------

	async function remove(card: Card) {
		error = '';
		try {
			await deleteCard(card);
		} catch (e) {
			error = `Löschen fehlgeschlagen: ${(e as Error).message}`;
		}
		await reload();
	}

	async function editForms(card: Card) {
		if (!card.word) return;
		error = '';
		try {
			const details = await getDetails({ word: card.word, pos: card.pos ?? 'other', gender: card.gender }, lang, card.german);
			const existing = cards.filter((c) => c.parentId === card.id);
			const initial = details.forms.filter((f) => existing.some((c) => c.formLabel === f.label && c.answer === f.answer));
			if (details.forms.length === 0) {
				notice = `Für „${card.answer}“ sind keine Sonderformen bekannt.`;
				return;
			}
			editing = { card, forms: details.forms, initial };
			await tick();
			document.getElementById('edit-forms')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
		} catch (e) {
			error = (e as Error).message;
		}
	}

	async function confirmEdit(chosen: FormCandidate[]) {
		if (!editing) return;
		await setForms(editing.card, chosen);
		editing = null;
		await reload();
	}
</script>

<svelte:head><title>Vokabeln hinzufügen – {lang.name}</title></svelte:head>

<h1>Vokabeln hinzufügen</h1>

{#if !connection.online}
	<p class="banner">Du bist offline. Zum Nachschlagen neuer Wörter braucht es eine Internetverbindung – abfragen geht aber auch offline.</p>
{/if}

<section class="entry card">
	<div class="fields">
		<Suggest
			id="german"
			label="Deutsch (ohne Artikel)"
			placeholder="z. B. Haus"
			bind:value={german}
			bind:input={germanInput}
			items={germanItems}
			loading={completing}
			disabled={!connection.online || !!pending}
			oninput={onGermanInput}
			onpick={pickGerman}
			lang="de"
		/>
		<span class="arrow" aria-hidden="true">→</span>
		<Suggest
			id="foreign"
			label={lang.name}
			placeholder={chosenGerman ? 'Übersetzung wählen oder eintippen' : 'zuerst deutsches Wort + Enter'}
			bind:value={foreign}
			bind:input={foreignInput}
			items={translationItems}
			loading={loadingTranslations}
			autoHighlight
			empty="Keine passende Übersetzung – Enter übernimmt deine Eingabe"
			disabled={!connection.online || !chosenGerman || busy || !!pending}
			onpick={pickTranslation}
			onescape={() => germanInput?.focus()}
			lang={lang.code}
		/>
	</div>
	{#if busy}
		<p class="status muted" role="status">Wird geladen…</p>
	{:else if error}
		<p class="status error" role="alert">{error}</p>
	{:else if notice}
		<p class="status ok" role="status">{notice}</p>
	{/if}
</section>

{#if pending}
	<FormPicker
		title={`Sonderformen von „${pending.details.answer}“`}
		forms={pending.details.forms}
		lang={lang.code}
		onconfirm={confirmForms}
		oncancel={cancelForms}
	/>
{/if}

{#if editing}
	<div id="edit-forms">
		<FormPicker
			title={`Sonderformen von „${editing.card.answer}“ bearbeiten`}
			forms={editing.forms}
			initial={editing.initial}
			confirmLabel="Speichern"
			lang={lang.code}
			onconfirm={confirmEdit}
			oncancel={() => (editing = null)}
		/>
	</div>
{/if}

<WordList {cards} lang={lang.code} online={connection.online} onplay={playCard} ondelete={remove} oneditforms={editForms} />

<style>
	.fields {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: end;
		gap: 0.8rem;
	}

	.arrow {
		padding-bottom: 0.75rem;
		color: var(--muted);
		font-size: 1.3rem;
	}

	.status {
		margin: 0.8rem 0 0;
		font-size: 0.95rem;
	}

	.error {
		color: var(--bad);
	}

	.ok {
		color: var(--ok);
	}

	.banner {
		padding: 0.8rem 1rem;
		border-radius: 10px;
		background: var(--bad-soft);
		color: var(--bad);
	}

	@media (max-width: 640px) {
		.fields {
			grid-template-columns: 1fr;
		}

		.arrow {
			display: none;
		}
	}
</style>
