<script lang="ts">
	import { cn } from '$lib/utils';
	import SuitIcon from './suit-icon.svelte';
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
		numberSizes,
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
		inspection?: boolean;
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
		inspection = false,
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
	const rankGlyph = $derived(
		isAce ? 'A' : isFaceCard ? (faceLetters[card.rank] ?? '') : String(RANK_NAMES[card.rank])
	);
	const centerGlyphSize = $derived(
		isFaceCard || isAce ? faceLetterSizes[size] : numberSizes[size]
	);
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
	const suitBg = $derived(
		playable || inspection
			? 'bg-white border-zinc-200 text-zinc-900 shadow-md'
			: 'bg-slate-200 border-slate-300 text-zinc-700 shadow-xs'
	);
	const bgClass = $derived(faceDown ? FACE_DOWN_BG : isRook ? rookBg : suitBg);
</script>

<button
	class={cn(
		'relative rounded-lg border font-bold transition-all select-none overflow-hidden duration-150',
		sizes[size],
		bgClass,
		isTrump && !faceDown && 'ring-2 ring-amber-400/90 border-amber-400 shadow-amber-950/20',
		playable &&
			'cursor-pointer hover:shadow-2xl hover:border-emerald-500/80 hover:-translate-y-1',
		!playable && !inspection && !faceDown && 'saturate-60 brightness-95 cursor-not-allowed shadow-xs',
		inspection && 'cursor-default pointer-events-none shadow-xs',
		selected && '-translate-y-3.5 border-2 border-emerald-500 shadow-2xl'
	)}
	aria-label={faceDown ? 'Face-down card' : label}
	data-playable={playable ? 'true' : 'false'}
	disabled={!playable || !onclick}
	{onclick}
>
	{#if faceDown}
		<div class="absolute inset-1 rounded-md border border-indigo-400/30 bg-gradient-to-br from-indigo-950 via-blue-950 to-slate-950 flex items-center justify-center overflow-hidden">
			<div class="w-full h-full opacity-20 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:6px_6px]"></div>
			<div class="absolute inset-1.5 rounded border border-indigo-400/25 flex items-center justify-center">
				<span class="text-indigo-300/40 text-xs">◆</span>
			</div>
		</div>
	{:else if isRook && rookCard}
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
	{:else}
		<span class="absolute top-1 left-1 sm:left-1.5 {cornerSizes[size]} {color} font-black leading-none flex flex-col items-center">
			<span class={cn('leading-none', rankGlyph === '10' && 'tracking-tighter')}>{rankGlyph}</span>
			<SuitIcon suit={card.suit} class="w-2.5 h-2.5 sm:w-3 sm:h-3 mt-0.5" />
		</span>
		<span
			class="absolute bottom-1 right-1.5 rotate-180 {cornerSizes[
				size
			]} {color} font-black leading-none flex flex-col items-center pointer-events-none"
		>
			<span class={cn('leading-none', rankGlyph === '10' && 'tracking-tighter')}>{rankGlyph}</span>
			<SuitIcon suit={card.suit} class="w-2.5 h-2.5 sm:w-3 sm:h-3 mt-0.5" />
		</span>
		<div class="absolute inset-0 flex items-center justify-center">
			<span class="{color} {centerGlyphSize} font-black tracking-tight drop-shadow-xs">
				{rankGlyph}
			</span>
		</div>
	{/if}
	{#if !faceDown && penaltyPoints > 0}
		<span
			class="absolute bottom-1.5 left-1 sm:left-1.5 text-[9px] sm:text-[10px] bg-rose-600 text-white rounded px-1 sm:px-1.5 py-0.5 leading-none font-black shadow-xs z-10 border border-rose-400/30"
			title="Penalty: +{penaltyPoints} pts (Avoid collecting)"
		>
			+{penaltyPoints}
		</span>
	{/if}
	{#if !faceDown && rookPoints > 0}
		<span
			class="absolute bottom-1.5 left-1.5 text-[9px] sm:text-[10px] bg-emerald-700 text-emerald-100 rounded px-1 sm:px-1.5 py-0.5 leading-none font-black shadow-xs z-10 border border-emerald-500/20"
			title="Point Card: +{rookPoints} pts"
		>
			+{rookPoints}
		</span>
	{/if}
	{#if !faceDown && isTrump}
		<span
			class="absolute {rookPoints > 0 ? 'bottom-6 sm:bottom-7' : 'bottom-1.5'} left-1.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-amber-500 text-amber-950 flex items-center justify-center text-[9px] sm:text-[10px] font-black shadow-xs z-10 border border-amber-600/30"
			title={rookPoints > 0 ? `Trump Point Card (+${rookPoints} pts)` : 'Trump Card'}
		>
			T
		</span>
	{/if}
</button>
