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
	const cardOverlap = $derived(
		sorted.length > 10 ? '-36px' : sorted.length > 7 ? '-26px' : sorted.length > 4 ? '-16px' : '10px'
	);
	const cardOverlapMobile = $derived(
		sorted.length > 10 ? '-26px' : sorted.length > 7 ? '-18px' : sorted.length > 4 ? '-10px' : '8px'
	);

	function isPlayable(card: Card): boolean {
		return playableCards.some((c) => c.suit === card.suit && c.rank === card.rank);
	}
</script>

<div class="w-full max-w-5xl mx-auto overflow-x-auto sm:overflow-visible card-fan-scroll">
	<div
		class="inline-flex min-w-full items-end justify-start sm:justify-center px-4 sm:px-6 pt-7 pb-2"
		style:--card-overlap={cardOverlap}
		style:--card-overlap-mobile={cardOverlapMobile}
	>
		{#each sorted as card, index (`${card.suit}-${card.rank}`)}
			<div
				class="card-hand-slot relative transition-transform duration-150 ease-out"
				class:is-playable={isPlayable(card)}
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
	.card-hand-slot + .card-hand-slot {
		margin-left: var(--card-overlap, -28px);
	}
	@media (max-width: 639px) {
		.card-hand-slot + .card-hand-slot {
			margin-left: var(--card-overlap-mobile, -22px);
		}
	}
	.card-hand-slot.is-playable:hover,
	.card-hand-slot.is-playable:focus-within {
		transform: translateY(-16px);
		z-index: 50 !important;
	}
</style>
