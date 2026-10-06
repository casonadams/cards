<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index';
	import type { Card, Suit } from '$lib/types/card';
	import { RANK_NAMES } from '$lib/types/card';

	interface Props {
		trumpSuit: Suit | null;
		trumpCard: Card | null;
	}

	let { trumpSuit, trumpCard }: Props = $props();

	const suitSymbols = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
	const suitColors = {
		hearts: 'text-red-400 fill-red-400',
		diamonds: 'text-red-400 fill-red-400',
		clubs: 'text-zinc-300 fill-zinc-300',
		spades: 'text-zinc-300 fill-zinc-300'
	};

	const cardLabel = $derived(
		trumpCard ? `${RANK_NAMES[trumpCard.rank]}${suitSymbols[trumpCard.suit]}` : ''
	);
</script>

<div
	class="bg-muted/30 border-b border-border px-4 py-1.5 flex flex-wrap gap-2 items-center text-xs justify-center sm:justify-start"
>
	<span class="text-muted-foreground font-medium">Trump:</span>
	{#if trumpSuit}
		<Badge variant="warning" class="gap-1.5 py-0.5 font-bold">
			<span class="capitalize">{trumpSuit}</span>
			{#if trumpCard}
				<span class="font-normal text-[11px] opacity-80">
					(cut: <span class={suitColors[trumpCard.suit]}>{cardLabel}</span>)
				</span>
			{/if}
		</Badge>
	{:else}
		<Badge variant="secondary" class="gap-1.5 py-0.5">
			<span>No Trump</span>
		</Badge>
	{/if}
</div>
