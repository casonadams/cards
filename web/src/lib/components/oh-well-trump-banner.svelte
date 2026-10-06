<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index';
	import type { Card, Suit } from '$lib/platform/types/index';
	import { RANK_NAMES } from '$lib/platform/types/card';

	interface Props {
		trumpSuit: Suit | null;
		trumpCard: Card | null;
	}

	let { trumpSuit, trumpCard }: Props = $props();

	const suitSymbols = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
	const suitColors: Record<Suit, string> = {
		hearts: 'text-rose-400 font-bold',
		diamonds: 'text-blue-400 font-bold',
		clubs: 'text-emerald-400 font-bold',
		spades: 'text-slate-200 font-bold'
	};
	const cardLabel = $derived(
		trumpCard ? `${RANK_NAMES[trumpCard.rank]}${suitSymbols[trumpCard.suit]}` : ''
	);
</script>

<div
	class="bg-card/60 backdrop-blur-sm border-b border-border/80 px-4 py-2 flex flex-wrap gap-2 items-center text-xs justify-center sm:justify-start"
>
	<span class="text-muted-foreground font-semibold">Trump Suit:</span>
	{#if trumpSuit}
		<Badge variant="warning" class="gap-1.5 py-0.5 font-bold bg-amber-500/15 text-amber-300 border-amber-500/30">
			<span class="capitalize text-xs">{trumpSuit} {suitSymbols[trumpSuit]}</span>
			{#if trumpCard}
				<span class="font-normal text-[11px] opacity-80 border-l border-amber-500/30 pl-1.5 ml-0.5">
					Cut: <span class={suitColors[trumpCard.suit]}>{cardLabel}</span>
				</span>
			{/if}
		</Badge>
	{:else}
		<Badge variant="secondary" class="gap-1.5 py-0.5 text-xs font-semibold">
			<span>No Trump</span>
		</Badge>
	{/if}
</div>
