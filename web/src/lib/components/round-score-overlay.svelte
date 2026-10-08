<script lang="ts">
	import { Button } from '$lib/components/ui/button/index';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card/index';
	import { Badge } from '$lib/components/ui/badge/index';
	import { getInitials } from '$lib/utils';
	import type { ScoreEntry } from '$lib/platform/types/index';

	interface Props {
		handLabel: string;
		scores: readonly ScoreEntry[];
		playerNames: Record<string, string>;
		onContinue: () => void;
		isHost: boolean;
		gameId?: string;
		winnerName?: string | null;
	}

	let { handLabel, scores, playerNames, onContinue, isHost, gameId = '', winnerName = null }: Props = $props();

	const isHighestScoreWins = $derived(gameId === 'oh-well' || gameId === 'rook');
	const sorted = $derived(
		[...scores].sort((a, b) => (isHighestScoreWins ? b.points - a.points : a.points - b.points))
	);
</script>
<div class="w-full max-w-md mx-auto animate-in fade-in duration-200">
	<Card class="border-border/80 bg-card/95 shadow-2xl overflow-hidden rounded-2xl border">
		<div class="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-t-2xl shrink-0"></div>
		<CardHeader class="text-center pb-2 pt-3 px-4 sm:px-6">
			<div class="flex items-center justify-between gap-2 mb-1">
				<Badge variant="outline" class="text-xs font-bold border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
					{handLabel}
				</Badge>
				{#if winnerName}
					<span class="text-xs font-bold text-amber-300">
						👑 {winnerName} won trick
					</span>
				{/if}
			</div>
			<CardTitle class="text-lg font-black">Round Completed — Scores</CardTitle>
		</CardHeader>
		<CardContent class="gap-3.5 pt-1 px-4 sm:px-6 pb-4">
			<div class="flex flex-col gap-1.5">
				{#each sorted as entry (entry.playerId)}
					<div class="flex justify-between items-center p-2 rounded-xl bg-background/50 border border-border/60">
						<div class="flex items-center gap-2">
							<div class="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground">
								{getInitials(playerNames[entry.playerId] ?? entry.playerId)}
							</div>
							<span class="text-xs sm:text-sm font-semibold">{playerNames[entry.playerId] ?? entry.playerId}</span>
						</div>
						<span
							class="font-mono text-xs font-black px-2.5 py-0.5 rounded-full {isHighestScoreWins
								? entry.points > 0
									? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
									: 'bg-muted text-muted-foreground'
								: entry.points === 0
									? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
									: 'bg-rose-500/15 text-rose-300 border border-rose-500/30'}"
						>
							{entry.points} pts
						</span>
					</div>
				{/each}
			</div>

			{#if isHost}
				<Button class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 shadow-md shadow-emerald-950/40 text-sm rounded-xl cursor-pointer" onclick={onContinue}>
					Next Hand →
				</Button>
			{:else}
				<div class="p-2.5 rounded-xl bg-background/40 border border-border/50 text-center">
					<p class="text-xs text-muted-foreground animate-pulse">Waiting for host to deal next hand...</p>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
