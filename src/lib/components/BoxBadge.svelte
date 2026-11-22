<script lang="ts">
	let { box, large = false }: { box: number; large?: boolean } = $props();
</script>

<span class="badge" class:large style:--c={`var(--box-${box})`} title={`Fach ${box} von 5`}>{box}</span>

<style>
	.badge {
		display: inline-grid;
		place-items: center;
		min-width: 1.7rem;
		height: 1.7rem;
		padding: 0 0.35rem;
		border-radius: 8px;
		background: var(--c);
		color: #fff;
		font-weight: 700;
		font-size: 0.9rem;
		text-shadow: 0 1px 1px rgb(0 0 0 / 25%);
		flex-shrink: 0;
	}

	.large {
		min-width: 2.4rem;
		height: 2.4rem;
		font-size: 1.15rem;
		border-radius: 10px;
	}
</style>
