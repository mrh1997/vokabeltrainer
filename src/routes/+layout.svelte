<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { findLanguage } from '#lib/languages.ts';
	import { requestPersistence } from '#lib/db/index.ts';
	import { connection } from '#lib/online.svelte.ts';
	import { voiceStatus } from '#lib/audio/voice-status.svelte.ts';

	let { children } = $props();

	const lang = $derived(page.params.lang ? findLanguage(page.params.lang) : undefined);
	const isHome = $derived(page.route.id === '/');

	onMount(() => {
		requestPersistence();
	});

	/** Parent page of the current page, for the back button. */
	const parent = $derived.by(() => {
		const id = page.route.id ?? '/';
		if (lang && id !== '/[lang]') return resolve('/[lang]', { lang: lang.code });
		return resolve('/');
	});
</script>

<div class="shell">
	<header>
		<div class="bar">
			{#if !isHome}
				<a class="icon-btn back" href={parent} aria-label="Zurück">←</a>
			{/if}
			<a class="brand" href={resolve('/')}>
				<span class="logo" aria-hidden="true">🗂️</span>
				<span>Vokabeltrainer</span>
			</a>
			<div class="right">
			{#if lang}
				<a class="lang" href={resolve('/[lang]', { lang: lang.code })}>
					{lang.flag ?? '🌐'} {lang.name}
				</a>
			{/if}
			{#if !connection.online}
				<span class="offline" title="Keine Internetverbindung – Abfragen funktioniert trotzdem">offline</span>
			{/if}
			</div>
		</div>
	</header>

	<main>
		{#if voiceStatus.missing}
			<div class="voice-hint" role="alert">
				<p>
					<strong>Keine Stimme für {voiceStatus.missing} auf diesem Gerät.</strong> Wörter ohne Aufnahme können deshalb nicht
					vorgelesen werden. Installiere eine Sprachausgabe für {voiceStatus.missing} – unter Windows: Einstellungen → Zeit und
					Sprache → Sprache und Region → Sprache hinzufügen (mit „Sprachausgabe“); auf Android/iOS in den Einstellungen unter
					„Sprachausgabe“ bzw. „Gesprochene Inhalte“. Danach den Browser neu starten.
				</p>
				<button class="icon-btn" aria-label="Hinweis schließen" onclick={() => (voiceStatus.missing = null)}>✕</button>
			</div>
		{/if}
		{@render children()}
	</main>

	<footer>
		<span>Daten: Wiktionary, Wikidata, Wikimedia Commons (CC BY-SA)</span>
		<span class="sep" aria-hidden="true">·</span>
		<a href={resolve('/impressum')}>Impressum &amp; Datenschutz</a>
	</footer>
</div>

<style>
	.shell {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}

	header {
		position: sticky;
		top: 0;
		z-index: 10;
		background: color-mix(in srgb, var(--surface) 88%, transparent);
		backdrop-filter: blur(10px);
		border-bottom: 1px solid var(--border);
		padding-top: env(safe-area-inset-top);
	}

	.bar {
		max-width: 960px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.45rem 1rem;
		min-height: 56px;
	}

	.back {
		text-decoration: none;
		font-size: 1.3rem;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-weight: 700;
		color: var(--text);
		text-decoration: none;
		font-size: 1.1rem;
	}

	.right {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.lang {
		padding: 0.3rem 0.75rem;
		border-radius: 999px;
		background: var(--accent-soft);
		color: var(--accent-strong);
		text-decoration: none;
		font-weight: 600;
		font-size: 0.9rem;
		white-space: nowrap;
	}

	.offline {
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		background: var(--bad-soft);
		color: var(--bad);
		font-size: 0.8rem;
		font-weight: 600;
	}

	.voice-hint {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		margin-bottom: 1rem;
		padding: 0.6rem 0.6rem 0.6rem 1rem;
		border-radius: 10px;
		background: var(--bad-soft);
		color: var(--text);
		font-size: 0.92rem;
	}

	.voice-hint p {
		margin: 0.2rem 0;
		flex: 1;
	}

	main {
		flex: 1;
		width: 100%;
		max-width: 960px;
		margin: 0 auto;
		padding: 1.2rem 1rem 2rem;
	}

	footer {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.4rem;
		padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom));
		color: var(--muted);
		font-size: 0.8rem;
		border-top: 1px solid var(--border);
	}

	@media (max-width: 480px) {
		.brand span:last-child,
		.sep {
			display: none;
		}
	}
</style>
