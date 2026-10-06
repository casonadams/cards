<script lang="ts">
	import { cn } from '$lib/utils';
	import { RANK_NAMES } from '$lib/platform/types/card';
	import { cardToRook } from '$lib/games/rook/card-adapter';
	import type { Card } from '$lib/platform/types/index';
	import { getCardPenalty } from '$lib/games/canadian-salad';
	import type { HandType } from '$lib/games/canadian-salad';
	import {
		suitSymbols,
		suitBgColors,
		suitTextColors,
		faceLetters,
		rookTextColors,
		sizes,
		cornerSizes,
		centerSuitSizes,
		faceLetterSizes,
		aceSuitSizes,
		rookValueSizes,
		getRookCardPoints,
		FACE_DOWN_BG,
		resolveRookBg
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
		gameId === 'canadian-salad' && handType ? getCardPenalty(card, handType as HandType) : 0
	);
	const isRook = $derived(gameId === 'rook');
	const rookCard = $derived(isRook ? cardToRook(card) : null);
	const rookPoints = $derived(rookCard ? getRookCardPoints(rookCard) : 0);
	const isTrump = $derived(
		gameId === 'oh-well'
			? trumpSuit !== null && card.suit === trumpSuit
			: isRook && trumpSuit !== null
				? rookCard?.type === 'bird' || (rookCard?.type === 'number' && rookCard.color === trumpSuit)
				: false
	);
	const isFaceCard = $derived(!isRook && card.rank >= 11 && card.rank <= 13);
	const isAce = $derived(!isRook && card.rank === 14);
	const symbol = $derived(suitSymbols[card.suit]);
	const color = $derived(suitTextColors[card.suit]);
	const label = $derived(
		isRook && rookCard
			? rookCard.type === 'bird'
				? 'Rook Bird'
				: `${rookCard.value} ${rookCard.color}`
			: `${RANK_NAMES[card.rank]} of ${card.suit}`
	);

	const rookBg = $derived(
		rookCard ? resolveRookBg(rookCard.type, 'color' in rookCard ? rookCard.color : '') : ''
	);
	const suitBg = 'bg-white border-zinc-200 text-zinc-900 shadow-md';
	const bgClass = $derived(faceDown ? FACE_DOWN_BG : isRook ? rookBg : suitBg);
</script>

<button
	class={cn(
		'relative rounded-lg border font-bold transition-all select-none overflow-hidden duration-150',
		sizes[size],
		bgClass,
		playable &&
			'cursor-pointer hover:-translate-y-2.5 hover:shadow-xl hover:border-emerald-500/70 hover:ring-2 hover:ring-emerald-500/20 active:scale-95',
		!playable && !faceDown && 'opacity-65 saturate-75 cursor-default',
		selected && '-translate-y-3.5 ring-2 ring-emerald-500 shadow-xl'
	)}
	aria-label={faceDown ? 'Face-down card' : label}
	disabled={!playable}
	{onclick}
>
	{#if faceDown}
		<div class="absolute inset-1 rounded-md border border-indigo-400/30 bg-gradient-to-br from-indigo-950 via-blue-950 to-slate-950 flex items-center justify-center overflow-hidden">
			<div class="w-full h-full opacity-20 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:6px_6px]"></div>
			<div class="absolute inset-1.5 rounded border border-indigo-400/25 flex items-center justify-center">
				<span class="text-indigo-300/40 text-xs">◆</span>
			</div>
		</div>
		{#if rookCard.type === 'bird'}
			<span
				class="absolute inset-0 flex items-center justify-center text-purple-200 {rookValueSizes[
					size
				]} font-black">R</span
			>
		{:else}
			<span
				class="absolute top-0.5 left-1 {cornerSizes[size]} {rookTextColors[
					rookCard.color
				]} font-bold opacity-70"
			>
				{rookCard.value}
			</span>
			<span
				class="absolute inset-0 flex items-center justify-center {rookTextColors[
					rookCard.color
				]} {rookValueSizes[size]} font-black"
			>
				{rookCard.value}
			</span>
		{/if}
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
		<div class="absolute inset-0 flex items-center justify-center">
			<span class="absolute text-2xl sm:text-3xl opacity-15 {suitTextColors[card.suit]}">{symbol}</span>
			<span class="{suitTextColors[card.suit]} {faceLetterSizes[size]} font-black tracking-tight drop-shadow-sm">
				{faceLetters[card.rank]}
			</span>
		</div>
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
	{#if !faceDown && rookPoints > 0}
		<span
			class="absolute top-1 right-1 text-[8px] sm:text-[9px] bg-emerald-700 text-emerald-100 rounded px-1 py-0.5 leading-none font-black shadow-sm z-10 border border-emerald-500/20"
		>
			+{rookPoints}
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
