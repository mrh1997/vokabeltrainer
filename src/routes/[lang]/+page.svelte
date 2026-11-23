<script lang="ts">
	import { resolve } from '$app/paths';
	import { exportBackup, importBackup, listCards, type Card } from '#lib/db/index.ts';
	import { BOX_COUNT, canQuiz } from '#lib/quiz/index.ts';

	let { data } = $props();
	const lang = $derived(data.language);

	let cards = $state<Card[]>([]);
	let message = $state('');
	let fileInput = $state<HTMLInputElement>();

	async function load() {
		cards = await listCards(lang.code);
	}

	$effect(() => {
		lang.code;
		load();
	});

	const quizOpen = $derived(canQuiz(cards));
	const perBox = $derived(Array.from({ length: BOX_COUNT }, (_, i) => cards.filter((c) => c.box === i + 1).length));

	async function download() {
		const blob = await exportBackup();
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `vokabeltrainer-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		setTimeout(() => URL.revokeObjectURL(a.href), 1000);
		message = 'Sicherung gespeichert.';
	}

	async function restore(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		try {
			const n = await importBackup(await file.text());
			message = `${n} Karten wiederhergestellt.`;
			await load();
		} catch (err) {
			message = `Wiederherstellen fehlgeschlagen: ${(err as Error).message}`;
		}
		(e.target as HTMLInputElement).value = '';
	}
</script>

<svelte:head><title>Vokabeltrainer – {lang.name}</title></svelte:head>

<h1><span aria-hidden="true">{lang.flag ?? '🌐'}</span> {lang.name}</h1>

<div class="actions">
	<a class="action card" href={resolve('/[lang]/hinzufuegen', { lang: lang.code })}>
		<span class="icon" aria-hidden="true">＋</span>
		<span class="title">Vokabeln hinzufügen</span>
		<span class="muted">Deutsches Wort eingeben, Übersetzung wählen</span>
	</a>
	<a
		class="action card primary"
		class:disabled={!quizOpen}
		href={resolve('/[lang]/abfragen', { lang: lang.code })}
		aria-disabled={!quizOpen}
	>
		<span class="icon" aria-hidden="true">▶</span>
		<span class="title">Vokabeln abfragen</span>
		<span class="sub">
			{#if quizOpen}{perBox[0]} von {cards.length} Karten in Fach 1
			{:else if cards.length}Fach 1 ist leer – füge neue Vokabeln hinzu
			{:else}Füge zuerst Vokabeln hinzu{/if}
		</span>
	</a>
</div>

{#if cards.length}
	<section class="card boxes">
		<h2>Karteikasten</h2>
		<div class="bar" role="img" aria-label={perBox.map((n, i) => `Fach ${i + 1}: ${n}`).join(', ')}>
			{#each perBox as n, i (i)}
				{#if n}
					<div class="segment" style:flex-grow={n} style:background={`var(--box-${i + 1})`}></div>
				{/if}
			{/each}
		</div>
		<div class="legend">
			{#each perBox as n, i (i)}
				<span><i style:background={`var(--box-${i + 1})`}></i>Fach {i + 1}: <b>{n}</b></span>
			{/each}
		</div>
	</section>
{/if}

<section class="backup">
	<h2>Sicherung</h2>
	<p class="muted">
		Deine Vokabeln liegen nur in diesem Browser. Speichere ab und zu eine Sicherung – damit kannst du sie auch auf ein anderes
		Gerät übertragen.
	</p>
	<div class="row">
		<button class="btn secondary" onclick={download}>Sicherung speichern</button>
		<button class="btn secondary" onclick={() => fileInput?.click()}>Sicherung laden</button>
		<input type="file" accept="application/json,.json" class="visually-hidden" bind:this={fileInput} onchange={restore} />
	</div>
	{#if message}<p role="status">{message}</p>{/if}
</section>

<style>
	.actions {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.action {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		min-height: 150px;
		justify-content: center;
		text-decoration: none;
		color: var(--text);
		transition: transform 0.12s, border-color 0.12s;
	}

	.action:hover {
		transform: translateY(-2px);
		border-color: var(--accent);
	}

	.action .icon {
		font-size: 2rem;
		line-height: 1;
		color: var(--accent);
	}

	.action .title {
		font-size: 1.3rem;
		font-weight: 700;
	}

	.primary {
		background: linear-gradient(135deg, var(--accent), var(--accent-strong));
		color: #fff;
		border-color: transparent;
	}

	.primary .icon {
		color: #fff;
	}

	.primary .sub {
		opacity: 0.85;
	}

	.disabled {
		pointer-events: none;
		opacity: 0.5;
	}

	.boxes {
		margin-bottom: 1.5rem;
	}

	.bar {
		display: flex;
		height: 14px;
		border-radius: 7px;
		overflow: hidden;
		gap: 2px;
		background: var(--surface-2);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1.1rem;
		margin-top: 0.8rem;
		font-size: 0.9rem;
	}

	.legend i {
		display: inline-block;
		width: 0.8rem;
		height: 0.8rem;
		border-radius: 3px;
		margin-right: 0.35rem;
		vertical-align: -1px;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}
</style>
