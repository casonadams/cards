<script lang="ts">
	import { cn } from '$lib/utils';
	import { RANK_NAMES, type Card } from '$lib/types/card';
	import type { TrickPlay } from './trick-area.svelte';

	interface Props {
		plays: readonly TrickPlay[];
		winnerName: string | null;
	}

	let { plays, winnerName }: Props = $props();

	const suitSymbols = { hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663', spades: '\u2660' };
	const suitColors: Record<string, string> = {
		hearts: 'text-red-400',
		diamonds: 'text-amber-400',
		clubs: 'text-sky-400',
		spades: 'text-slate-300'
	};

	function formatStandardCard(card: Card): { label: string; colorClass: string } {
		return {
			label: `${RANK_NAMES[card.rank]}${suitSymbols[card.suit]}`,
			colorClass: suitColors[card.suit] ?? 'text-foreground'
		};
	}
</script>

{#if plays.length > 0}
	<div class="flex items-center justify-center gap-1.5 px-2 py-0.5">
		<span class="text-[10px] text-muted-foreground">Last:</span>
		{#each plays as play (play.playerId)}
			{@const fmt = formatStandardCard(play.card)}
			<span class={cn('text-[10px]', fmt.colorClass)}>
				{fmt.label}
			</span>
		{/each}
		{#if winnerName}
			<span class="text-[10px] text-success font-medium">- {winnerName}</span>
		{/if}
	</div>
{/if}
