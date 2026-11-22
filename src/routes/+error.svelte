<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
</script>

<svelte:head><title>Nicht gefunden – Vokabeltrainer</title></svelte:head>

<section class="card error">
	<h1>{page.status === 404 ? 'Seite nicht gefunden' : 'Da ist etwas schiefgelaufen'}</h1>
	<p class="muted">{page.error?.message}</p>
	<a class="btn" href={resolve('/')}>Zur Startseite</a>
</section>

<style>
	.error {
		text-align: center;
		padding: 2rem 1rem;
	}
</style>
