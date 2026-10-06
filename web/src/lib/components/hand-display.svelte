<script lang="ts">
	import PlayingCard from './playing-card.svelte';
	import { sortHand } from '$lib/engine/sort-hand';
	import type { Card, Suit } from '$lib/types/card';

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

	const sorted = $derived(sortHand(cards, trumpSuit as Suit | null | undefined));

	function isPlayable(card: Card): boolean {
		return playableCards.some((c) => c.suit === card.suit && c.rank === card.rank);
	}
</script>

<div class="flex flex-wrap justify-center gap-1 p-2">
	{#each sorted as card (`${card.suit}-${card.rank}`)}
		<PlayingCard
			{card}
			{gameId}
			{handType}
			{trumpSuit}
			playable={isPlayable(card)}
			onclick={() => onCardPlayed?.(card)}
		/>
	{/each}
</div>
