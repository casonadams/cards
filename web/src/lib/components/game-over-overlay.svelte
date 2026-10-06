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

<div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto p-4">
	<Card class="w-full max-w-lg">
		<CardHeader class="text-center">
			<CardTitle>Game Over</CardTitle>
			{#if winnerId}
				<p class="text-lg mt-2">
					<Badge variant="success" class="text-base px-3 py-1">
						{playerNames[winnerId]} wins!
					</Badge>
				</p>
			{/if}
		</CardHeader>
		<CardContent class="space-y-6">
			<ScoreTable {playerNames} {rounds} {playerIds} />

			<div class="space-y-2">
				<h3 class="text-sm font-semibold text-muted-foreground">Final Standings</h3>
				{#each totals as entry, i (entry.id)}
					<div class="flex justify-between items-center py-1">
						<span>
							<span class="text-muted-foreground mr-2">{i + 1}.</span>
							{playerNames[entry.id]}
						</span>
						<span class="font-mono font-bold">{entry.total} pts</span>
					</div>
				{/each}
			</div>

			<Button class="w-full" onclick={onBackToLobby}>Back to Lobby</Button>
		</CardContent>
	</Card>
</div>
