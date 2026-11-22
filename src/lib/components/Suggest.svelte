<!--
	Text field with a suggestion list underneath (accessible combobox).
	Arrow up/down moves the highlight, Enter picks the highlighted item or —
	if none is highlighted — submits the typed text.
-->
<script lang="ts" module>
	export interface SuggestItem {
		key: string;
		primary: string;
		secondary?: string;
	}
</script>

<script lang="ts">
	let {
		id,
		label,
		value = $bindable(''),
		items,
		placeholder = '',
		disabled = false,
		loading = false,
		empty = '',
		autoHighlight = false,
		input = $bindable(),
		onpick,
		oninput,
		onescape,
		lang
	}: {
		id: string;
		label: string;
		value?: string;
		items: SuggestItem[];
		placeholder?: string;
		disabled?: boolean;
		loading?: boolean;
		/** Text shown when the list is empty (after typing). */
		empty?: string;
		/** Highlight the first item automatically. */
		autoHighlight?: boolean;
		input?: HTMLInputElement;
		/** Called with the chosen item, or null when the typed text is submitted. */
		onpick: (item: SuggestItem | null) => void;
		oninput?: (value: string) => void;
		onescape?: () => void;
		lang?: string;
	} = $props();

	let active = $state(-1);
	let focused = $state(false);

	$effect(() => {
		// reset the highlight whenever the list changes
		items;
		active = autoHighlight && items.length ? 0 : -1;
	});

	const open = $derived(focused && !disabled && (items.length > 0 || loading || (!!empty && !!value.trim())));

	function keydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (items.length) active = (active + 1) % items.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (items.length) active = active <= 0 ? items.length - 1 : active - 1;
		} else if (e.key === 'Enter') {
			e.preventDefault();
			onpick(active >= 0 ? items[active] : null);
		} else if (e.key === 'Escape') {
			onescape?.();
		}
	}
</script>

<div class="suggest">
	<label for={id}>{label}</label>
	<input
		{id}
		type="text"
		role="combobox"
		aria-expanded={open}
		aria-controls={`${id}-list`}
		aria-autocomplete="list"
		aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
		autocomplete="off"
		autocapitalize="off"
		spellcheck="false"
		{lang}
		{placeholder}
		{disabled}
		bind:value
		bind:this={input}
		onkeydown={keydown}
		oninput={() => oninput?.(value)}
		onfocus={() => (focused = true)}
		onblur={() => setTimeout(() => (focused = false), 150)}
	/>
	{#if open}
		<ul class="list" id={`${id}-list`} role="listbox">
			{#if loading && items.length === 0}
				<li class="info">Suche…</li>
			{:else if items.length === 0}
				<li class="info">{empty}</li>
			{/if}
			{#each items as item, i (item.key)}
				<li
					id={`${id}-opt-${i}`}
					role="option"
					aria-selected={i === active}
					class:active={i === active}
					onpointerdown={(e) => {
						e.preventDefault();
						onpick(item);
					}}
					onpointerenter={() => (active = i)}
				>
					<span class="primary" {lang}>{item.primary}</span>
					{#if item.secondary}<span class="secondary">{item.secondary}</span>{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.suggest {
		position: relative;
	}

	label {
		display: block;
		font-weight: 600;
		font-size: 0.9rem;
		margin-bottom: 0.35rem;
		color: var(--muted);
	}

	.list {
		position: absolute;
		z-index: 20;
		left: 0;
		right: 0;
		top: calc(100% + 4px);
		margin: 0;
		padding: 0.3rem;
		list-style: none;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		box-shadow: var(--shadow);
		max-height: min(50vh, 360px);
		overflow-y: auto;
	}

	li {
		display: flex;
		flex-direction: column;
		padding: 0.5rem 0.7rem;
		border-radius: 8px;
		cursor: pointer;
	}

	li.active {
		background: var(--accent-soft);
	}

	.primary {
		font-weight: 600;
	}

	.secondary {
		font-size: 0.85rem;
		color: var(--muted);
	}

	.info {
		color: var(--muted);
		cursor: default;
	}
</style>
