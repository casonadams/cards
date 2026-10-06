<script lang="ts">
	import { cn } from '$lib/utils';
	import { RANK_NAMES, type Card } from '$lib/types/card';
	import {
		suitSymbols,
		suitBgColors,
		suitTextColors,
		faceLetters,
		sizes,
		cornerSizes,
		centerSuitSizes,
		faceLetterSizes,
		aceSuitSizes,
		FACE_DOWN_BG,
		getCanadianPenalty
	} from './playing-card-styles';

	interface Props {
		card: Card;
		gameId?: string;
		handType?: string;
		trumpSuit?: string | null;
		playable?: boolean;
		selected?: boolean;
		faceDown?: boolean;
		size?: 'sm' | 'md';
		onclick?: () => void;
	}

	let {
		card,
		gameId = '',
		handType = '',
		trumpSuit = null,
		playable = false,
		selected = false,
		faceDown = false,
		size = 'md',
		onclick
	}: Props = $props();

	const penaltyPoints = $derived(
		gameId === 'canadian-salad' && handType ? getCanadianPenalty(card, handType) : 0
	);
	const isTrump = $derived(trumpSuit !== null && card.suit === trumpSuit);
	const isFaceCard = $derived(card.rank >= 11 && card.rank <= 13);
	const isAce = $derived(card.rank === 14);
	const symbol = $derived(suitSymbols[card.suit]);
	const color = $derived(suitTextColors[card.suit]);
	const label = $derived(`${RANK_NAMES[card.rank]} of ${card.suit}`);
	const suitBg = $derived(`${suitBgColors[card.suit]} border-border`);
	const bgClass = $derived(faceDown ? FACE_DOWN_BG : suitBg);
</script>

<button
	class={cn(
		'relative rounded-lg border-2 font-bold transition-all select-none overflow-hidden',
		sizes[size],
		bgClass,
		playable && 'cursor-pointer hover:-translate-y-2 hover:shadow-lg',
		!playable && 'cursor-default',
		selected && '-translate-y-3 ring-2 ring-success'
	)}
	aria-label={faceDown ? 'Face-down card' : label}
	disabled={!playable}
	{onclick}
>
	{#if faceDown}
		<div class="absolute inset-1 rounded border border-blue-600 bg-blue-800"></div>
	{:else if isFaceCard}
		<span
			class="absolute top-0.5 left-1 {cornerSizes[size]} {suitTextColors[
				card.suit
			]} font-bold leading-none"
		>
			{RANK_NAMES[card.rank]}<br /><span class="text-[8px] sm:text-[10px]">{symbol}</span>
		</span>
		<span
			class="absolute bottom-0.5 right-1 rotate-180 {cornerSizes[size]} {suitTextColors[
				card.suit
			]} font-bold leading-none"
		>
			{RANK_NAMES[card.rank]}<br /><span class="text-[8px] sm:text-[10px]">{symbol}</span>
		</span>
		<span
			class="absolute inset-0 flex items-center justify-center {suitTextColors[
				card.suit
			]} {faceLetterSizes[size]} font-black"
		>
			{faceLetters[card.rank]}
		</span>
	{:else if isAce}
		<span class="absolute top-0.5 left-1 {cornerSizes[size]} {color} font-bold leading-none">
			A<br /><span class="text-[8px] sm:text-[10px]">{symbol}</span>
		</span>
		<span
			class="absolute bottom-0.5 right-1 rotate-180 {cornerSizes[
				size
			]} {color} font-bold leading-none"
		>
			A<br /><span class="text-[8px] sm:text-[10px]">{symbol}</span>
		</span>
		<span
			class={cn('absolute inset-0 flex items-center justify-center', color, aceSuitSizes[size])}
		>
			{symbol}
		</span>
	{:else}
		<span class="absolute top-0.5 left-1 {cornerSizes[size]} {color} font-bold leading-none">
			{RANK_NAMES[card.rank]}<br /><span class="text-[8px] sm:text-[10px]">{symbol}</span>
		</span>
		<span
			class="absolute bottom-0.5 right-1 rotate-180 {cornerSizes[
				size
			]} {color} font-bold leading-none"
		>
			{RANK_NAMES[card.rank]}<br /><span class="text-[8px] sm:text-[10px]">{symbol}</span>
		</span>
		<span
			class={cn('absolute inset-0 flex items-center justify-center', color, centerSuitSizes[size])}
		>
			{symbol}
		</span>
	{/if}
	{#if !faceDown && penaltyPoints > 0}
		<span
			class="absolute top-1 right-1 text-[8px] sm:text-[9px] bg-destructive text-destructive-foreground rounded px-1 py-0.5 leading-none font-black shadow-sm z-10 border border-destructive-foreground/20"
		>
			{penaltyPoints}
		</span>
	{/if}
	{#if !faceDown && isTrump}
		<span
			class="absolute bottom-1 left-1 text-[8px] sm:text-[9px] bg-amber-500 text-amber-950 rounded px-1 py-0.5 leading-none font-black shadow-sm z-10 border border-amber-400/20"
		>
			T
		</span>
	{/if}
</button>
