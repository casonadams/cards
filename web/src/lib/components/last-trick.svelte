<script lang="ts">
	import { cn } from '$lib/utils';
	import { RANK_NAMES } from '$lib/platform/types/card';
	import { cardToRook } from '$lib/games/rook/card-adapter';
	import type { Card } from '$lib/platform/types/index';
	import type { TrickPlay } from '$lib/platform/engine/index';

	interface Props {
		plays: readonly TrickPlay[];
		winnerName: string | null;
		gameId?: string;
	}

	let { plays, winnerName, gameId = '' }: Props = $props();

	const suitSymbols = { hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663', spades: '\u2660' };
	const suitColors: Record<string, string> = {
		hearts: 'text-rose-400',
		diamonds: 'text-blue-400',
		clubs: 'text-emerald-400',
		spades: 'text-slate-200'
	};
	const rookColors = {
		black: 'text-foreground',
		red: 'text-red-400',
		green: 'text-green-400',
		yellow: 'text-yellow-400'
	};

	function formatRookCard(card: Card): { label: string; colorClass: string } {
		const rook = cardToRook(card);
		if (rook.type === 'bird') return { label: 'Bird', colorClass: 'text-purple-400' };
		return { label: `${rook.value}`, colorClass: rookColors[rook.color] };
	}

	function formatStandardCard(card: Card): { label: string; colorClass: string } {
		return {
			label: `${RANK_NAMES[card.rank]}${suitSymbols[card.suit]}`,
			colorClass: suitColors[card.suit] ?? 'text-foreground'
		};
	}

	function formatCard(card: Card): { label: string; colorClass: string } {
		return gameId === 'rook' ? formatRookCard(card) : formatStandardCard(card);
	}
</script>

{#if plays.length > 0}
	<div class="flex flex-wrap items-center justify-center gap-2 px-3 py-1 mt-1 rounded-full bg-background/50 border border-border/60 backdrop-blur-sm text-xs shadow-sm">
		<span class="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">Last Trick:</span>
		<div class="flex items-center gap-1.5">
			{#each plays as play (play.playerId)}
				{@const fmt = formatCard(play.card)}
				<span class={cn('font-bold font-mono text-[11px] px-1.5 py-0.5 rounded bg-card/70 border border-border/50', fmt.colorClass)}>
					{fmt.label}
				</span>
			{/each}
		</div>
		{#if winnerName}
			<span class="text-[11px] text-emerald-400 font-bold border-l border-border/80 pl-2">
				{winnerName}
			</span>
		{/if}
	</div>
{/if}
