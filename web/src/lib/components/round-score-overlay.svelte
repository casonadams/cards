<script lang="ts">
	import { Button } from '$lib/components/ui/button/index';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card/index';

	interface Props {
		handLabel: string;
		scores: readonly { playerId: string; points: number }[];
		playerNames: Record<string, string>;
		onContinue: () => void;
	}

	let { handLabel, scores, playerNames, onContinue }: Props = $props();

	const sorted = $derived([...scores].sort((a, b) => a.points - b.points));
</script>

<div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
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

			<Button class="w-full" onclick={onContinue}>Next Hand</Button>
		</CardContent>
	</Card>
</div>
