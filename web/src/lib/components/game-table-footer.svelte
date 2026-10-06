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

<footer class="border-t border-border px-4 py-2 flex justify-between items-center">
	<Button variant="ghost" size="sm" onclick={onLeave}>Leave Game</Button>
	<div class="flex gap-4 text-xs text-muted-foreground">
		{#if isOhWell}
			<span
				>Tricks/Bid: <span class="text-foreground font-medium">{myStatLine(ctx, myId)}</span></span
			>
			<span
				>Score: <span class="text-foreground font-medium">{previousTotals[myId] ?? 0}</span></span
			>
		{:else if isRook}
			<span class="{myTeam === 1 ? 'text-blue-400' : 'text-amber-400'} font-medium"
				>Team {myTeam}</span
			>
			<span>Tricks: <span class="text-foreground font-medium">{myStatLine(ctx, myId)}</span></span>
		{:else}
			<span>Tricks: <span class="text-foreground font-medium">{myStatLine(ctx, myId)}</span></span>
			<span
				>Points: <span class="text-foreground font-medium"
					>{(previousTotals[myId] ?? 0) +
						(allPlayerStats.find((s) => s.playerId === myId)?.currentScore ?? 0)}</span
				></span
			>
		{/if}
	</div>
</footer>
