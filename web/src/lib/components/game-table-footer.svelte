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
			? 'bg-emerald-950/90 border-emerald-400 shadow-[0_-4px_24px_rgba(16,185,129,0.35)] ring-1 ring-emerald-500/50 text-emerald-100'
			: 'bg-card/75 border-border/80 text-muted-foreground'
	)}
>
	<Button
		variant="ghost"
		size="sm"
		class={cn(
			'text-xs h-8 shrink-0',
			isMyTurn
				? 'text-emerald-300/80 hover:text-destructive hover:bg-destructive/10'
				: 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
		)}
		onclick={onLeave}
	>
		← Leave
	</Button>

	{#if isMyTurn}
		<div class="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1 rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-400/50 shadow-sm animate-pulse">
			<span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
			<span class="font-black text-xs sm:text-sm tracking-wide uppercase">Your Turn</span>
		</div>
	{:else}
		<span class="text-[11px] text-muted-foreground/50 hidden sm:inline">Waiting for turn...</span>
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
