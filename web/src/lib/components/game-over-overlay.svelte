<script lang="ts">
	import { Button } from '$lib/components/ui/button/index';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card/index';
	import { Badge } from '$lib/components/ui/badge/index';
	import ScoreTable from './score-table.svelte';
	import type { RoundScore } from '$lib/platform/engine/index';

	interface Props {
		playerNames: Record<string, string>;
		playerIds: readonly string[];
		rounds: readonly RoundScore[];
		onBackToLobby: () => void;
	}

	let { playerNames, playerIds, rounds, onBackToLobby }: Props = $props();

	const totals = $derived(
		playerIds
			.map((id) => ({
				id,
				total: rounds.reduce((sum, r) => {
					const entry = r.scores.find((s) => s.playerId === id);
					return sum + (entry?.points ?? 0);
				}, 0)
			}))
			.sort((a, b) => a.total - b.total)
	);

	const winnerId = $derived(totals[0]?.id);
</script>

<div class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 overflow-y-auto p-4 animate-in fade-in duration-200">
	<Card class="w-full max-w-lg border-border/80 bg-card/95 shadow-2xl overflow-hidden my-auto">
		<div class="h-1.5 w-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500"></div>
		<CardHeader class="text-center pb-2">
			<div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-400/10 text-amber-400 text-2xl mx-auto mb-2 border border-amber-400/20 shadow-inner">
				🏆
			</div>
			<CardTitle class="text-2xl font-black">Game Over</CardTitle>
			{#if winnerId}
				<div class="mt-2">
					<div class="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30 text-sm font-bold shadow-sm">
						<span>🎉</span>
						<span>{playerNames[winnerId]} takes the victory!</span>
					</div>
				</div>
			{/if}
		</CardHeader>
		<CardContent class="gap-6 pt-2">
			<ScoreTable {playerNames} {rounds} {playerIds} />

			<div class="flex flex-col gap-2.5">
				<h3 class="text-xs uppercase tracking-wider font-bold text-muted-foreground px-1">Final Standings</h3>
				<div class="grid gap-1.5">
					{#each totals as entry, i (entry.id)}
						<div class="flex justify-between items-center p-2.5 rounded-lg bg-background/50 border border-border/60">
							<div class="flex items-center gap-2.5">
								<span class="w-5 text-center text-xs font-bold {i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-muted-foreground'}">
									{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
								</span>
								<span class="text-sm font-semibold">{playerNames[entry.id]}</span>
							</div>
							<span class="font-mono text-sm font-bold {i === 0 ? 'text-emerald-400' : 'text-muted-foreground'}">
								{entry.total} pts
							</span>
						</div>
					{/each}
				</div>
			</div>

			<Button class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 shadow-md shadow-emerald-950/40 text-sm" onclick={onBackToLobby}>
				Back to Lobby
			</Button>
		</CardContent>
	</Card>
</div>
