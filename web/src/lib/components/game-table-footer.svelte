<script lang="ts">
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
	}

	let { isOhWell, isRook, myTeam, ctx, myId, previousTotals, allPlayerStats, onLeave }: Props =
		$props();
</script>

<footer class="border-t border-border/80 bg-card/60 backdrop-blur-md px-4 py-2.5 flex justify-between items-center text-xs">
	<Button
		variant="ghost"
		size="sm"
		class="text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs h-8"
		onclick={onLeave}
	>
		← Leave Game
	</Button>
	<div class="flex items-center gap-2 sm:gap-3">
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
