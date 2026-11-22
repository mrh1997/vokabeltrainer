<!--
	Endless quiz: German prompt → type the exact foreign answer → Enter.
	Shows right/wrong (with the correct spelling), always plays the
	pronunciation, and moves the card between boxes. Enter again → next card.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import BoxBadge from '#lib/components/BoxBadge.svelte';
	import { listCards, recordAnswer, type Card } from '#lib/db/index.ts';
	import { checkAnswer, pickNext } from '#lib/quiz/index.ts';
	import { playCard } from '#lib/audio/index.ts';
	import { addMissingPrompts } from '#lib/upgrade.ts';

	let { data } = $props();
	const lang = $derived(data.language);

	let cards = $state<Card[]>([]);
	let loaded = $state(false);
	let current = $state<Card>();
	let answer = $state('');
	let result = $state<{ correct: boolean; given: string; before: number; after: number } | null>(null);
	let session = $state({ asked: 0, correct: 0 });
	let input = $state<HTMLInputElement>();
	let nextButton = $state<HTMLButtonElement>();

	$effect(() => {
		lang.code;
		start();
	});

	async function start() {
		loaded = false;
		cards = await listCards(lang.code);
		loaded = true;
		session = { asked: 0, correct: 0 };
		await next();
		// older special-form cards: fetch their German prompt, then refresh what is shown
		if (await addMissingPrompts(lang)) {
			const fresh = await listCards(lang.code);
			const byId = new Map(fresh.map((c) => [c.id, c]));
			cards = cards.map((c) => (byId.get(c.id) ? { ...c, prompt: byId.get(c.id)!.prompt } : c));
			if (current) current = { ...current, prompt: byId.get(current.id)?.prompt };
		}
	}

	async function next() {
		current = pickNext(cards, current?.id);
		answer = '';
		result = null;
		await tick();
		input?.focus();
	}

	async function submit() {
		if (!current || result) return;
		if (!answer.trim()) return;
		const correct = checkAnswer(current.answer, answer);
		const before = current.box;
		const updated = await recordAnswer(current, correct);
		cards = cards.map((c) => (c.id === updated.id ? updated : c));
		current = updated;
		result = { correct, given: answer, before, after: updated.box };
		session = { asked: session.asked + 1, correct: session.correct + (correct ? 1 : 0) };
		playCard(updated);
		await tick();
		nextButton?.focus();
	}

	function keydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			submit();
		}
	}

	/** Letters used in this language's answers that a German keyboard lacks. */
	const specialChars = $derived.by(() => {
		const chars = new Set<string>();
		for (const c of cards) for (const ch of c.answer) if (/\p{L}/u.test(ch) && !/[a-zA-ZäöüÄÖÜß]/.test(ch)) chars.add(ch.toLowerCase());
		return [...chars].sort((a, b) => a.localeCompare(b, lang.code)).slice(0, 40);
	});

	function insert(ch: string) {
		if (!input || result) return;
		const start = input.selectionStart ?? answer.length;
		const end = input.selectionEnd ?? answer.length;
		answer = answer.slice(0, start) + ch + answer.slice(end);
		tick().then(() => {
			input?.focus();
			input?.setSelectionRange(start + ch.length, start + ch.length);
		});
	}

	const hint = $derived.by(() => {
		if (!current) return '';
		if (current.parentId) return '';
		if (lang.code === 'en') return 'Nomen mit a/an, Verben mit to';
		if (['fr', 'es', 'it', 'pt', 'nl'].includes(lang.code)) return 'Nomen mit Artikel';
		return '';
	});
</script>

<svelte:head><title>Abfragen – {lang.name}</title></svelte:head>

{#if loaded && !current}
	<section class="card empty">
		<h1>Noch nichts zum Abfragen</h1>
		<p class="muted">Füge zuerst ein paar Vokabeln hinzu.</p>
		<a class="btn" href={resolve('/[lang]/hinzufuegen', { lang: lang.code })}>Vokabeln hinzufügen</a>
	</section>
{:else if current}
	<div class="stats muted">
		<span>Diese Runde: <b>{session.correct}</b> von <b>{session.asked}</b> richtig</span>
		<span>{cards.length} Karten</span>
	</div>

	<section class="quiz card" class:right={result?.correct} class:wrong={result && !result.correct}>
		<div class="top">
			<BoxBadge box={result ? result.before : current.box} large />
			<span class="muted asked">{current.asked}× abgefragt</span>
		</div>

		<!-- special forms ask their German counterpart ("ich gehe"); older cards fall back to word + description -->
		<p class="prompt" lang="de">{current.prompt || current.german}</p>
		{#if current.parentId && !current.prompt && current.formLabel}
			<p class="form-label">{current.formLabel}</p>
		{:else if current.meaning}
			<p class="form-label muted">{current.meaning}</p>
		{/if}

		<label class="visually-hidden" for="answer">Übersetzung auf {lang.name}</label>
		<input
			id="answer"
			type="text"
			lang={lang.code}
			autocomplete="off"
			autocapitalize="off"
			spellcheck="false"
			placeholder={`Auf ${lang.name}…`}
			bind:value={answer}
			bind:this={input}
			onkeydown={keydown}
			readonly={!!result}
		/>
		{#if hint && !result}<p class="hint muted">{hint}</p>{/if}

		{#if specialChars.length && !result}
			<div class="chars" aria-label="Sonderzeichen einfügen">
				{#each specialChars as ch (ch)}
					<button type="button" tabindex="-1" onpointerdown={(e) => e.preventDefault()} onclick={() => insert(ch)}>{ch}</button>
				{/each}
			</div>
		{/if}

		{#if result}
			<div class="result" role="status">
				{#if result.correct}
					<p class="verdict">✓ Richtig!</p>
				{:else}
					<p class="verdict">✗ Leider falsch</p>
					<p>Richtig ist: <b class="solution" lang={lang.code}>{current.answer}</b></p>
				{/if}
				<p class="move muted">
					Fach {result.before} → <BoxBadge box={result.after} />
					<button class="icon-btn" aria-label="Nochmal anhören" onclick={() => current && playCard(current)}>🔊</button>
				</p>
			</div>
			<button class="btn next" bind:this={nextButton} onclick={next}>Weiter ⏎</button>
		{:else}
			<button class="btn next" onclick={submit} disabled={!answer.trim()}>Prüfen ⏎</button>
		{/if}
	</section>
{/if}

<style>
	.empty {
		text-align: center;
		padding: 2rem 1rem;
	}

	.stats {
		display: flex;
		justify-content: space-between;
		font-size: 0.9rem;
		margin-bottom: 0.7rem;
	}

	.quiz {
		max-width: 620px;
		margin: 0 auto;
		padding: 1.5rem;
		transition: border-color 0.2s, background 0.2s;
	}

	.quiz.right {
		border-color: var(--ok);
		background: var(--ok-soft);
	}

	.quiz.wrong {
		border-color: var(--bad);
		background: var(--bad-soft);
	}

	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.asked {
		font-size: 0.9rem;
	}

	.prompt {
		font-size: clamp(1.7rem, 6vw, 2.4rem);
		font-weight: 700;
		text-align: center;
		margin: 1rem 0 0.2rem;
		overflow-wrap: anywhere;
	}

	.form-label {
		text-align: center;
		margin: 0 0 1rem;
		font-weight: 600;
		color: var(--accent);
	}

	.form-label.muted {
		font-weight: 400;
		color: var(--muted);
	}

	input {
		margin-top: 0.8rem;
		font-size: 1.25rem;
		text-align: center;
	}

	input[readonly] {
		background: transparent;
	}

	.hint {
		text-align: center;
		font-size: 0.85rem;
		margin: 0.4rem 0 0;
	}

	.chars {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.35rem;
		margin-top: 0.8rem;
	}

	.chars button {
		min-width: 2.4rem;
		height: 2.4rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface-2);
		cursor: pointer;
		font-size: 1.05rem;
	}

	.chars button:hover {
		border-color: var(--accent);
	}

	.result {
		text-align: center;
		margin-top: 1rem;
	}

	.result p {
		margin: 0.3rem 0;
	}

	.verdict {
		font-size: 1.4rem;
		font-weight: 700;
	}

	.right .verdict {
		color: var(--ok);
	}

	.wrong .verdict {
		color: var(--bad);
	}

	.solution {
		font-size: 1.2rem;
	}

	.move {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
	}

	.next {
		display: flex;
		width: 100%;
		margin-top: 1.2rem;
		font-size: 1.1rem;
	}
</style>
