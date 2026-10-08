<script lang="ts">
	import PlayingCard from './playing-card.svelte';
	import { sortHand } from '$lib/platform/engine/sort-hand';
	import { sortRookHand } from '$lib/games/rook/sort-hand';
	import { recordPlayedCardPosition } from '$lib/utils';
	import type { Card, Suit } from '$lib/platform/types/index';
	interface Props {
		cards: readonly Card[];
		playableCards?: readonly Card[];
		gameId?: string;
		trumpSuit?: string | null;
		handType?: string;
		onCardPlayed?: (card: Card) => void;
		interactive?: boolean;
		inspection?: boolean;
	}

	let {
		cards,
		playableCards = [],
		gameId = '',
		trumpSuit = null,
		handType = '',
		onCardPlayed,
		interactive = true,
		inspection = false
	}: Props = $props();

	const sorted = $derived(
		gameId === 'rook'
			? sortRookHand(cards, trumpSuit)
			: sortHand(cards, trumpSuit as Suit | null | undefined)
	);
	const cardOverlap = $derived(
		sorted.length > 14
			? '-54px'
			: sorted.length > 10
				? '-42px'
				: sorted.length > 7
					? '-28px'
					: sorted.length > 4
						? '-16px'
						: '8px'
	);
	const cardOverlapMobile = $derived(
		sorted.length > 14
			? '-42px'
			: sorted.length > 10
				? '-34px'
				: sorted.length > 7
					? '-24px'
					: sorted.length > 4
						? '-12px'
						: '6px'
	);

	function isPlayable(card: Card): boolean {
		if (!interactive || !onCardPlayed) return false;
		return playableCards.some((c) => c.suit === card.suit && c.rank === card.rank);
	}

	function handleCardClick(card: Card, key: string) {
		if (!interactive || !isPlayable(card) || !onCardPlayed) return;
		if (typeof document !== 'undefined') {
			const el = document.querySelector(`[data-card-key="${key}"]`);
			recordPlayedCardPosition(el as HTMLElement);
		}
		onCardPlayed(card);
	}
</script>

<div class="w-full max-w-5xl mx-auto overflow-x-auto sm:overflow-visible card-fan-scroll min-h-[130px] sm:min-h-[160px] flex items-end">
	<div
		class="inline-flex min-w-full items-end justify-start sm:justify-center px-4 sm:px-6 pt-7 pb-2 min-h-[130px] sm:min-h-[160px]"
		style:--card-overlap={cardOverlap}
		style:--card-overlap-mobile={cardOverlapMobile}
	>
		{#if sorted.length === 0}
			<div class="flex items-center justify-center w-full py-8 select-none">
				<span class="text-xs text-muted-foreground/40 font-medium">All cards played</span>
			</div>
		{:else}
			{#each sorted as card, index (`${card.suit}-${card.rank}`)}
				{@const key = `${card.suit}-${card.rank}`}
				<div
				data-card-key={key}
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
					{inspection}
					onclick={interactive && isPlayable(card) && onCardPlayed ? () => handleCardClick(card, key) : undefined}
				/>
				</div>
			{/each}
		{/if}
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
		transform: translateY(-18px);
	}
</style>
