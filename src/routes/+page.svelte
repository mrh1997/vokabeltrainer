<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { LANGUAGES, findLanguage, type Language } from '#lib/languages.ts';
	import { addLanguage, countCards, listLanguages } from '#lib/db/index.ts';

	let learned = $state<{ lang: Language; count: number }[]>([]);
	let loaded = $state(false);
	let picking = $state(false);
	let filter = $state('');
	let filterInput = $state<HTMLInputElement>();

	onMount(async () => {
		const entries = await listLanguages();
		learned = await Promise.all(
			entries
				.map((e) => findLanguage(e.code))
				.filter((l): l is Language => !!l)
				.map(async (lang) => ({ lang, count: await countCards(lang.code) }))
		);
		loaded = true;
		if (learned.length === 0) picking = true;
	});

	const available = $derived(
		LANGUAGES.filter(
			(l) =>
				!learned.some((x) => x.lang.code === l.code) &&
				(l.name.toLowerCase().includes(filter.trim().toLowerCase()) || l.code === filter.trim().toLowerCase())
		)
	);

	async function start(lang: Language) {
		await addLanguage(lang.code);
		await goto(resolve('/[lang]', { lang: lang.code }));
	}

	function openPicker() {
		picking = true;
		queueMicrotask(() => filterInput?.focus());
	}

	function onFilterKey(e: KeyboardEvent) {
		if (e.key === 'Enter' && available.length > 0) start(available[0]);
	}
</script>

<svelte:head><title>Vokabeltrainer – Sprache wählen</title></svelte:head>

<section class="intro">
	<h1>Welche Sprache möchtest du lernen?</h1>
	<p class="muted">Wähle eine Sprache, dann kannst du Vokabeln hinzufügen oder dich abfragen lassen.</p>
</section>

{#if loaded && learned.length > 0}
	<div class="grid">
		{#each learned as { lang, count } (lang.code)}
			<a class="lang-card card" href={resolve('/[lang]', { lang: lang.code })}>
				<span class="flag" aria-hidden="true">{lang.flag ?? '🌐'}</span>
				<span class="name">{lang.name}</span>
				<span class="muted count">{count} {count === 1 ? 'Karte' : 'Karten'}</span>
			</a>
		{/each}
		{#if !picking}
			<button class="lang-card card add" onclick={openPicker}>
				<span class="flag" aria-hidden="true">＋</span>
				<span class="name">Neue Sprache…</span>
			</button>
		{/if}
	</div>
{/if}

{#if loaded && picking}
	<section class="picker card">
		<h2>{learned.length ? 'Neue Sprache hinzufügen' : 'Sprache wählen'}</h2>
		<input
			type="search"
			placeholder="Sprache suchen, z. B. Spanisch"
			bind:value={filter}
			bind:this={filterInput}
			onkeydown={onFilterKey}
			aria-label="Sprache suchen"
		/>
		<div class="options">
			{#each available as lang (lang.code)}
				<button class="option" onclick={() => start(lang)}>
					<span aria-hidden="true">{lang.flag ?? '🌐'}</span>
					{lang.name}
				</button>
			{:else}
				<p class="muted">Keine passende Sprache gefunden.</p>
			{/each}
		</div>
	</section>
{/if}

<style>
	.intro {
		margin: 0.5rem 0 1.5rem;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.lang-card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.3rem;
		text-decoration: none;
		color: var(--text);
		cursor: pointer;
		font: inherit;
		text-align: left;
		transition: transform 0.12s, border-color 0.12s;
	}

	.lang-card:hover {
		transform: translateY(-2px);
		border-color: var(--accent);
	}

	.flag {
		font-size: 2.2rem;
		line-height: 1;
	}

	.name {
		font-weight: 700;
		font-size: 1.15rem;
	}

	.count {
		font-size: 0.9rem;
	}

	.add {
		border-style: dashed;
		box-shadow: none;
		background: transparent;
	}

	.add .flag {
		color: var(--accent);
	}

	.options {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
		gap: 0.5rem;
		margin-top: 1rem;
		max-height: 55vh;
		overflow-y: auto;
	}

	.option {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-height: 48px;
		padding: 0.5rem 0.8rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface-2);
		cursor: pointer;
		text-align: left;
	}

	.option:hover,
	.option:focus-visible {
		border-color: var(--accent);
		background: var(--accent-soft);
	}
</style>
