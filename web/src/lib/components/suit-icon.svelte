<script lang="ts">
	import type { Suit } from '$lib/platform/types/index';

	interface Props {
		suit: Suit;
		class?: string;
	}

	let { suit, class: className = '' }: Props = $props();

</script>

{#if suit === 'hearts'}
	<svg viewBox="0 0 100 100" class={className} fill="currentColor">
		<path
			d="M50 88 C25 65, 0 45, 0 28 C0 10, 15 0, 28 0 C38 0, 46 6, 50 15 C54 6, 62 0, 72 0 C85 0, 100 10, 100 28 C100 45, 75 65, 50 88Z"
		/>
	</svg>
{:else if suit === 'diamonds'}
	<svg viewBox="0 0 100 120" class={className} fill="currentColor">
		<path d="M50 0 L95 60 L50 120 L5 60Z" />
	</svg>
{:else if suit === 'clubs'}
	<svg viewBox="0 0 100 100" class={className} fill="currentColor">
		<circle cx="50" cy="26" r="22" />
		<circle cx="26" cy="56" r="22" />
		<circle cx="74" cy="56" r="22" />
		<path d="M43 54 L57 54 L60 92 L40 92 Z" />
	</svg>
{:else}
	<svg viewBox="0 0 100 100" class={className} fill="currentColor">
		<path
			d="M50 4 C24 32, 0 48, 0 68 C0 84, 15 94, 28 94 C38 94, 45 88, 50 82 C55 88, 62 94, 72 94 C85 94, 100 84, 100 68 C100 48, 76 32, 50 4Z"
		/>
		<path d="M43 78 L57 78 L60 96 L40 96 Z" />
	</svg>
{/if}
