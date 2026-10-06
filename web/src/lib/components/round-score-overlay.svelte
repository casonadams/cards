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
	}

	let { handLabel, scores, playerNames, onContinue, isHost }: Props = $props();

	const sorted = $derived([...scores].sort((a, b) => a.points - b.points));
</script>

<div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
	<Card class="w-full max-w-md">
		<CardHeader>
			<CardTitle class="text-center">{handLabel} - Results</CardTitle>
		</CardHeader>
		<CardContent class="space-y-4">
			<div class="space-y-2">
				{#each sorted as entry (entry.playerId)}
					<div class="flex justify-between items-center py-1 border-b border-border/50">
						<span>{playerNames[entry.playerId] ?? entry.playerId}</span>
						<span class="font-mono font-bold">{entry.points} pts</span>
					</div>
				{/each}
			</div>

			{#if isHost}
				<Button class="w-full" onclick={onContinue}>Next Hand</Button>
			{:else}
				<p class="text-center text-sm text-muted-foreground">Waiting for host...</p>
			{/if}
		</CardContent>
	</Card>
</div>
