<script lang="ts">
	import { cn } from '$lib/utils';
	import { Button } from '$lib/components/ui/button/index';
	import { myStatLine, type StatContext } from './game-table-stats';
	import type { PlayerStats } from '$lib/platform/types/index';

	interface Props {
		isOhWell: boolean;
		isRook: boolean;
		myTeam: number | null;
		ctx: StatContext;
		myId: string;
		previousTotals: Record<string, number>;
		allPlayerStats: readonly PlayerStats[];
		onLeave: () => void;
		isMyTurn?: boolean;
	}

	let {
		isOhWell,
		isRook,
		myTeam,
		ctx,
		myId,
		previousTotals,
		allPlayerStats,
		onLeave,
		isMyTurn = false
	}: Props = $props();
</script>
<footer
	class={cn(
		'border-t backdrop-blur-md px-3 sm:px-6 py-2 flex justify-between items-center text-xs transition-all duration-300',
		isMyTurn
			? 'bg-emerald-950/40 border-emerald-500/50 text-foreground shadow-xs'
			: 'bg-card/75 border-border/80 text-muted-foreground'
	)}
>
	<Button
		variant="ghost"
		size="sm"
		class="text-xs h-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
		onclick={onLeave}
	>
		← Leave Game
	</Button>

	{#if isMyTurn}
		<span class="text-[11px] text-emerald-400 font-bold hidden sm:inline">Select a card from your hand</span>
	{:else}
		<span class="text-[11px] text-muted-foreground/50 hidden sm:inline">Waiting for opponent...</span>
	{/if}

	<div class="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
		{#if isOhWell}
			<div class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/60 border border-border">
				<span class="text-muted-foreground">Tricks/Bid:</span>
				<span class="font-bold text-foreground">{myStatLine(ctx, myId)}</span>
			</div>
			<div class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/60 border border-border">
				<span class="text-muted-foreground">Score:</span>
				<span class="font-bold text-foreground">{previousTotals[myId] ?? 0}</span>
			</div>
		{:else if isRook}
			<div class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/60 border border-border">
				<span class="{myTeam === 1 ? 'text-blue-400' : 'text-amber-400'} font-bold">Team {myTeam}</span>
			</div>
			<div class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/60 border border-border">
				<span class="text-muted-foreground">Tricks:</span>
				<span class="font-bold text-foreground">{myStatLine(ctx, myId)}</span>
			</div>
		{:else}
			<div class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/60 border border-border">
				<span class="text-muted-foreground">Tricks:</span>
				<span class="font-bold text-foreground">{myStatLine(ctx, myId)}</span>
			</div>
			<div class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/60 border border-border">
				<span class="text-muted-foreground">Points:</span>
				<span class="font-bold text-foreground">
					{(previousTotals[myId] ?? 0) +
						(allPlayerStats.find((s) => s.playerId === myId)?.currentScore ?? 0)}
				</span>
			</div>
		{/if}
	</div>
</footer>
