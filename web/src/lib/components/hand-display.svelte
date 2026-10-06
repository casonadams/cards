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
</script>

<div class="w-full max-w-4xl mx-auto px-4 overflow-x-auto sm:overflow-visible card-fan-scroll">
	<div class="flex items-end justify-center min-w-max pt-6 pb-2 {overlapClass}">
		{#each sorted as card, index (`${card.suit}-${card.rank}`)}
			<div
				class="card-hand-slot relative transition-transform duration-150 ease-out"
				style:z-index={index}
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
	.card-hand-slot:hover,
	.card-hand-slot:focus-within {
		transform: translateY(-14px);
		z-index: 50 !important;
	}
</style>
