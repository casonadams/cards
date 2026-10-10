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
	let containerWidth = $state(0);
	let windowHeight = $state(typeof window !== 'undefined' ? window.innerHeight : 800);

	const isMobile = $derived(
		(containerWidth > 0 && containerWidth < 640) || (windowHeight > 0 && windowHeight < 520)
	);
	const cardWidth = $derived(isMobile ? 52 : 80);
	const horizontalPad = $derived(isMobile ? 12 : 32);
	const normalGap = $derived(isMobile ? 4 : 10);

	const overlapCalc = $derived.by(() => {
		const count = sorted.length;
		if (count <= 1 || containerWidth === 0) {
			return { overlap: normalGap, isCentered: true };
		}

		const availWidth = Math.max(containerWidth - horizontalPad, cardWidth);
		const nonOverlapWidth = count * cardWidth + (count - 1) * normalGap;
		if (nonOverlapWidth <= availWidth) {
			return { overlap: normalGap, isCentered: true };
		}

		const step = (availWidth - cardWidth) / (count - 1);
		const minStep = isMobile ? 16 : 26;
		const clampedStep = Math.max(minStep, step);
		const computedOverlap = Math.round(clampedStep - cardWidth);

		return {
			overlap: computedOverlap,
			isCentered: step >= minStep
		};
	});

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

<svelte:window bind:innerHeight={windowHeight} />

<div
	bind:clientWidth={containerWidth}
	class="w-full max-w-5xl mx-auto overflow-x-auto sm:overflow-visible card-fan-scroll h-[90px] sm:tall:h-[130px] flex items-end shrink-0"
>
	<div
		class="inline-flex min-w-full items-end pt-2 sm:tall:pt-5 pb-1 h-full"
		class:justify-center={overlapCalc.isCentered}
		class:justify-start={!overlapCalc.isCentered}
		style:padding-left={`${Math.round(horizontalPad / 2)}px`}
		style:padding-right={`${Math.round(horizontalPad / 2)}px`}
		style:--card-overlap={`${overlapCalc.overlap}px`}
	>
		{#if sorted.length === 0}
			<div class="flex items-center justify-center w-full h-[76px] sm:tall:h-[116px] select-none">
				<span class="text-xs text-muted-foreground/40 font-medium">All cards played</span>
			</div>
		{:else}
			{#each sorted as card, index (`${card.suit}-${card.rank}-${index}`)}
				{@const key = `${card.suit}-${card.rank}-${index}`}
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
		margin-left: var(--card-overlap, -24px);
	}
	.card-hand-slot.is-playable:hover,
	.card-hand-slot.is-playable:focus-within {
		transform: translateY(-10px);
	}
</style>
