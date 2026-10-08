<script lang="ts">
	import { Button } from '$lib/components/ui/button/index';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card/index';
	import type { ScoreEntry } from '$lib/platform/types/index';

	interface Props {
		handLabel: string;
		scores: readonly ScoreEntry[];
		playerNames: Record<string, string>;
		onContinue: () => void;
		isHost: boolean;
		gameId?: string;
	}

	let { handLabel, scores, playerNames, onContinue, isHost, gameId = '' }: Props = $props();

	const isHighestScoreWins = $derived(gameId === 'oh-well' || gameId === 'rook');
	const sorted = $derived(
		[...scores].sort((a, b) => (isHighestScoreWins ? b.points - a.points : a.points - b.points))
	);
</script>

<div class="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
	<Card class="w-full max-w-md border-border/80 bg-card/95 shadow-2xl overflow-hidden rounded-xl">
		<div class="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-t-xl shrink-0"></div>
		<CardHeader class="text-center pb-2">
			<CardTitle class="text-xl font-black">{handLabel}</CardTitle>
			<p class="text-xs text-muted-foreground">Round Completed — Score Summary</p>
		</CardHeader>
		<CardContent class="gap-5 pt-2">
			<div class="flex flex-col gap-2">
				{#each sorted as entry (entry.playerId)}
					<div class="flex justify-between items-center p-2.5 rounded-lg bg-background/50 border border-border/60">
						<div class="flex items-center gap-2.5">
							<div class="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground">
								{(playerNames[entry.playerId] ?? entry.playerId).slice(0, 2).toUpperCase()}
							</div>
							<span class="text-sm font-semibold">{playerNames[entry.playerId] ?? entry.playerId}</span>
						</div>
						<span
							class="font-mono text-xs font-black px-3 py-1 rounded-full {isHighestScoreWins
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
				<Button class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 shadow-md shadow-emerald-950/40 text-sm" onclick={onContinue}>
					Next Hand →
				</Button>
			{:else}
				<div class="p-3 rounded-lg bg-background/40 border border-border/50 text-center">
					<p class="text-xs text-muted-foreground animate-pulse">Waiting for host to deal next hand...</p>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
