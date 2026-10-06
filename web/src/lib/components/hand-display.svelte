<script lang="ts">
	import PlayingCard from './playing-card.svelte';
	import { sortHand } from '$lib/platform/engine/sort-hand';
	import { sortRookHand } from '$lib/games/rook/sort-hand';
	import type { Card, Suit } from '$lib/platform/types/index';

	interface Props {
		cards: readonly Card[];
		playableCards?: readonly Card[];
		gameId?: string;
		trumpSuit?: string | null;
		handType?: string;
		onCardPlayed?: (card: Card) => void;
	}

	let {
		cards,
		playableCards = [],
		gameId = '',
		trumpSuit = null,
		handType = '',
		onCardPlayed
	}: Props = $props();

	const sorted = $derived(
		gameId === 'rook'
			? sortRookHand(cards, trumpSuit)
			: sortHand(cards, trumpSuit as Suit | null | undefined)
	);
	const overlapClass = $derived(
		sorted.length > 8
			? '-space-x-4 sm:-space-x-5'
			: sorted.length > 4
				? '-space-x-2 sm:-space-x-3'
				: 'gap-2 sm:gap-3'
	);

	function isPlayable(card: Card): boolean {
		return playableCards.some((c) => c.suit === card.suit && c.rank === card.rank);
	}

	function getFanRotation(index: number, total: number): number {
		if (total <= 3) return 0;
		const center = (total - 1) / 2;
		const normalized = (index - center) / (center || 1);
		return Number((normalized * 4.5).toFixed(1));
	}
</script>

<div class="w-full max-w-4xl mx-auto px-2 overflow-x-auto card-fan-scroll">
	<div class="flex items-end justify-center min-w-max pt-8 pb-3 px-6 {overlapClass} transition-all">
		{#each sorted as card, index (`${card.suit}-${card.rank}`)}
			<div
				class="card-fan-item relative transition-all duration-200 origin-bottom"
				style:z-index={index}
				style:--fan-rot="{getFanRotation(index, sorted.length)}deg"
			>
				<PlayingCard
					{card}
					{gameId}
					{handType}
					{trumpSuit}
					playable={isPlayable(card)}
					onclick={() => onCardPlayed?.(card)}
				/>
			</div>
		{/each}
	</div>
</div>

<style>
	.card-fan-item {
		transform: rotate(var(--fan-rot, 0deg));
	}
	.card-fan-item:hover,
	.card-fan-item:focus-within {
		transform: translateY(-16px) scale(1.06) rotate(0deg) !important;
		z-index: 40 !important;
	}
</style>
