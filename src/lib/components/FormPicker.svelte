<!--
	Checklist of special forms. Arrow keys move, Space ticks/unticks,
	Enter confirms, Escape cancels.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { FormCandidate } from '#lib/lookup/index.ts';

	let {
		title,
		forms,
		initial = [],
		confirmLabel = 'Hinzufügen',
		lang,
		onconfirm,
		oncancel
	}: {
		title: string;
		forms: FormCandidate[];
		initial?: FormCandidate[];
		confirmLabel?: string;
		lang?: string;
		onconfirm: (chosen: FormCandidate[]) => void;
		oncancel: () => void;
	} = $props();

	const key = (f: FormCandidate) => `${f.label}|${f.answer}`;
	let checked = $state<Record<string, boolean>>({});
	let active = $state(0);
	let listEl = $state<HTMLElement>();

	onMount(() => {
		checked = Object.fromEntries(initial.map((f) => [key(f), true]));
		listEl?.focus();
	});

	const count = $derived(forms.filter((f) => checked[key(f)]).length);

	function toggle(i: number) {
		const k = key(forms[i]);
		checked[k] = !checked[k];
		active = i;
	}

	function setAll(value: boolean) {
		checked = Object.fromEntries(forms.map((f) => [key(f), value]));
	}

	function confirm() {
		onconfirm(forms.filter((f) => checked[key(f)]));
	}

	function keydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			active = (active + 1) % forms.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			active = active <= 0 ? forms.length - 1 : active - 1;
		} else if (e.key === ' ') {
			e.preventDefault();
			toggle(active);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			confirm();
		} else if (e.key === 'Escape') {
			oncancel();
		}
	}

	$effect(() => {
		listEl?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
	});
</script>

<div class="picker card">
	<div class="head">
		<h3>{title}</h3>
		<div class="quick">
			<button class="link" onclick={() => setAll(true)}>Alle</button>
			<button class="link" onclick={() => setAll(false)}>Keine</button>
		</div>
	</div>
	<p class="muted hint">Wähle die Sonderformen, die du mitlernen willst. <kbd>↑</kbd><kbd>↓</kbd> bewegen, <kbd>Leertaste</kbd> an/aus, <kbd>Enter</kbd> übernehmen.</p>
	<ul
		class="list"
		role="listbox"
		aria-multiselectable="true"
		aria-label={title}
		tabindex="0"
		bind:this={listEl}
		onkeydown={keydown}
		aria-activedescendant={`form-${active}`}
	>
		{#each forms as f, i (key(f))}
			<!-- keyboard handling lives on the list (arrows + space), as for a native listbox -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<li
				id={`form-${i}`}
				data-i={i}
				role="option"
				aria-selected={!!checked[key(f)]}
				class:active={i === active}
				class:checked={checked[key(f)]}
				onclick={() => toggle(i)}
			>
				<span class="box" aria-hidden="true">{checked[key(f)] ? '✓' : ''}</span>
				<span class="label">{f.label}</span>
				<span class="answer" {lang}>{f.answer}</span>
			</li>
		{/each}
	</ul>
	<div class="buttons">
		<button class="btn secondary" onclick={oncancel}>Abbrechen</button>
		<button class="btn" onclick={confirm}>{confirmLabel}{count ? ` (+${count} ${count === 1 ? 'Form' : 'Formen'})` : ''}</button>
	</div>
</div>

<style>
	.picker {
		margin-top: 1rem;
		border-color: var(--accent);
	}

	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}

	h3 {
		margin: 0;
	}

	.quick {
		display: flex;
		gap: 0.8rem;
	}

	.link {
		border: 0;
		background: none;
		color: var(--accent);
		font-weight: 600;
		cursor: pointer;
		padding: 0.3rem;
	}

	.hint {
		font-size: 0.85rem;
		margin: 0.4rem 0 0.8rem;
	}

	kbd {
		display: inline-block;
		padding: 0 0.35em;
		border: 1px solid var(--border);
		border-bottom-width: 2px;
		border-radius: 4px;
		font-size: 0.8em;
		margin: 0 0.1em;
		font-family: inherit;
	}

	@media (pointer: coarse) {
		.hint {
			display: none;
		}
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0.25rem;
		max-height: 45vh;
		overflow-y: auto;
		border-radius: 10px;
		outline: none;
		border: 2px solid transparent;
	}

	.list:focus-visible {
		border-color: var(--accent-soft);
	}

	li {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.7rem;
		padding: 0.55rem 0.6rem;
		border-radius: 8px;
		cursor: pointer;
		min-height: 44px;
	}

	li.active {
		background: var(--surface-2);
	}

	.box {
		display: grid;
		place-items: center;
		width: 1.4rem;
		height: 1.4rem;
		border: 2px solid var(--border);
		border-radius: 6px;
		font-weight: 700;
		font-size: 0.9rem;
		color: #fff;
	}

	li.checked .box {
		background: var(--accent);
		border-color: var(--accent);
	}

	.label {
		color: var(--muted);
		font-size: 0.92rem;
	}

	.answer {
		font-weight: 600;
		text-align: right;
	}

	.buttons {
		display: flex;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin-top: 0.9rem;
	}
</style>
