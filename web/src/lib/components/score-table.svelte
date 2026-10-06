<script lang="ts">
	export interface RoundScore {
		round: number;
		label: string;
		scores: readonly { playerId: string; points: number }[];
	}

	interface Props {
		playerNames: Record<string, string>;
		rounds: readonly RoundScore[];
		playerIds: readonly string[];
	}

	let { playerNames, rounds, playerIds }: Props = $props();

	function totalFor(playerId: string): number {
		return rounds.reduce((sum, r) => {
			const entry = r.scores.find((s) => s.playerId === playerId);
			return sum + (entry?.points ?? 0);
		}, 0);
	}
</script>

<div class="overflow-x-auto">
	<table class="w-full text-sm">
		<thead>
			<tr class="border-b border-border">
				<th class="p-2 text-left text-muted-foreground">Hand</th>
				{#each playerIds as id (id)}
					<th class="p-2 text-center">{playerNames[id] ?? id}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rounds as round (round.round)}
				<tr class="border-b border-border/50">
					<td class="p-2 text-muted-foreground">{round.label}</td>
					{#each playerIds as id (id)}
						<td class="p-2 text-center"
							>{round.scores.find((s) => s.playerId === id)?.points ?? 0}</td
						>
					{/each}
				</tr>
			{/each}
		</tbody>
		<tfoot>
			<tr class="font-bold">
				<td class="p-2">Total</td>
				{#each playerIds as id (id)}
					<td class="p-2 text-center">{totalFor(id)}</td>
				{/each}
			</tr>
		</tfoot>
	</table>
</div>
