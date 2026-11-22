<!--
	All cards of a language, newest first, grouped by calendar week.
	Special forms are shown indented under their main word.
-->
<script lang="ts">
	import type { Card } from '#lib/db/index.ts';
	import { groupByWeek } from '#lib/quiz/index.ts';
	import BoxBadge from './BoxBadge.svelte';

	let {
		cards,
		lang,
		online,
		onplay,
		ondelete,
		oneditforms
	}: {
		cards: Card[];
		lang: string;
		online: boolean;
		onplay: (card: Card) => void;
		ondelete: (card: Card) => void;
		oneditforms: (card: Card) => void;
	} = $props();

	interface Entry {
		createdAt: number;
		main: Card;
		forms: Card[];
	}

	const groups = $derived.by(() => {
		const entries: Entry[] = [];
		const byId = new Map<string, Entry>();
		for (const c of cards) {
			if (!c.parentId) {
				const e = { createdAt: c.createdAt, main: c, forms: [] };
				entries.push(e);
				byId.set(c.id, e);
			}
		}
		for (const c of cards) if (c.parentId) byId.get(c.parentId)?.forms.push(c);
		// newest entry (and newest week) first; special forms keep their order under the main word
		return groupByWeek(entries.reverse());
	});
</script>

{#snippet row(card: Card, isForm: boolean)}
	<li class="row" class:form={isForm}>
		<BoxBadge box={card.box} />
		<div class="text">
			<span class="german">
				{#if isForm}<span class="form-label">{card.formLabel}</span>{:else}{card.german}{/if}
				{#if !isForm && card.meaning}<span class="meaning">({card.meaning})</span>{/if}
			</span>
			<span class="answer" {lang}>{card.answer}</span>
		</div>
		<span class="asked" title="So oft schon abgefragt">{card.asked}×</span>
		<div class="tools">
			<button class="icon-btn" aria-label={`${card.answer} anhören`} onclick={() => onplay(card)}>🔊</button>
			{#if !isForm && card.word}
				<button
					class="icon-btn"
					aria-label={`Sonderformen von ${card.answer} bearbeiten`}
					title={online ? 'Sonderformen bearbeiten' : 'Nur online möglich'}
					disabled={!online}
					onclick={() => oneditforms(card)}>✎</button
				>
			{/if}
			<button class="icon-btn delete" aria-label={`${card.answer} löschen`} onclick={() => ondelete(card)}>🗑</button>
		</div>
	</li>
{/snippet}

{#if groups.length === 0}
	<p class="muted empty">Noch keine Vokabeln. Gib oben ein deutsches Wort ein.</p>
{/if}

{#each groups as group (group.key)}
	<section class="week">
		<h3>
			{group.label}
			<span class="muted">· {group.items.reduce((n, e) => n + 1 + e.forms.length, 0)} Karten</span>
		</h3>
		<ul class="card">
			{#each group.items as entry (entry.main.id)}
				{@render row(entry.main, false)}
				{#each entry.forms as form (form.id)}
					{@render row(form, true)}
				{/each}
			{/each}
		</ul>
	</section>
{/each}

<style>
	.week {
		margin-top: 1.4rem;
	}

	h3 {
		font-size: 0.95rem;
		margin-bottom: 0.5rem;
	}

	h3 .muted {
		font-weight: 400;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0.3rem 0.6rem;
	}

	.row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) 2.6rem 7.5rem;
		align-items: center;
		gap: 0.75rem;
		padding: 0.55rem 0;
		border-top: 1px solid var(--border);
	}

	.row:first-child {
		border-top: 0;
	}

	.row.form {
		border-top-style: dashed;
	}

	.row.form .german {
		padding-left: 1.2rem;
	}

	.row.form .german::before {
		content: '↳ ';
		color: var(--muted);
		margin-left: -1.2rem;
	}

	.row.form .answer {
		font-weight: 500;
	}

	.text {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 0.2rem 1rem;
		min-width: 0;
	}

	.german,
	.answer {
		overflow-wrap: anywhere;
	}

	.answer {
		font-weight: 600;
	}

	.meaning,
	.form-label {
		color: var(--muted);
		font-size: 0.85rem;
	}

	.meaning {
		margin-left: 0.3rem;
	}

	.asked {
		text-align: right;
		color: var(--muted);
		font-size: 0.85rem;
		font-variant-numeric: tabular-nums;
	}

	.tools {
		display: flex;
		justify-content: flex-end;
	}

	.icon-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.delete:hover {
		color: var(--bad);
	}

	.empty {
		margin-top: 1.5rem;
		text-align: center;
	}

	@media (max-width: 600px) {
		.text {
			grid-template-columns: 1fr;
		}

		.row {
			gap: 0.5rem;
			grid-template-columns: auto minmax(0, 1fr) 2.2rem 6.75rem;
		}


		.icon-btn {
			width: 36px;
			height: 36px;
		}
	}
</style>
