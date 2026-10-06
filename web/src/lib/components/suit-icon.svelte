<script lang="ts">
	import type { Suit } from '$lib/platform/types/index';

	interface Props {
		suit: Suit;
		class?: string;
	}

	let { suit, class: className = '' }: Props = $props();

	const colors: Record<Suit, string> = {
		hearts: '#e11d48',
		diamonds: '#2563eb',
		clubs: '#059669',
		spades: '#cbd5e1'
	};
</script>

{#if suit === 'hearts'}
	<svg viewBox="0 0 100 100" class={className} fill={colors.hearts}>
		<path
			d="M50 88 C25 65, 0 45, 0 28 C0 10, 15 0, 28 0 C38 0, 46 6, 50 15 C54 6, 62 0, 72 0 C85 0, 100 10, 100 28 C100 45, 75 65, 50 88Z"
		/>
	</svg>
{:else if suit === 'diamonds'}
	<svg viewBox="0 0 100 120" class={className} fill={colors.diamonds}>
		<path d="M50 0 L95 60 L50 120 L5 60Z" />
	</svg>
{:else if suit === 'clubs'}
	<svg viewBox="0 0 100 100" class={className} fill={colors.clubs}>
		<circle cx="50" cy="25" r="22" />
		<circle cx="27" cy="55" r="22" />
		<circle cx="73" cy="55" r="22" />
		<rect x="44" y="55" width="12" height="35" rx="2" />
	</svg>
{:else}
	<svg viewBox="0 0 100 100" class={className} fill={colors.spades}>
		<path
			d="M50 5 C25 30, 0 45, 0 65 C0 82, 15 92, 28 92 C38 92, 45 87, 50 80 C55 87, 62 92, 72 92 C85 92, 100 82, 100 65 C100 45, 75 30, 50 5Z"
		/>
		<rect x="44" y="78" width="12" height="18" rx="2" />
	</svg>
{/if}
