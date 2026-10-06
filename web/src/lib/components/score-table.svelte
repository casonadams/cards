<script lang="ts">
	import type { RoundScore } from '$lib/platform/engine/index';

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

<div class="overflow-x-auto rounded-xl border border-border/80 bg-background/40">
	<table class="w-full text-xs sm:text-sm">
		<thead>
			<tr class="border-b border-border/80 bg-muted/30">
				<th class="p-2.5 text-left font-semibold text-muted-foreground">Hand</th>
				{#each playerIds as id (id)}
					<th class="p-2.5 text-center font-bold text-foreground truncate max-w-[90px]">{playerNames[id] ?? id}</th>
				{/each}
			</tr>
		</thead>
		<tbody class="divide-y divide-border/40">
			{#each rounds as round (round.round)}
				<tr class="hover:bg-muted/20 transition-colors">
					<td class="p-2.5 text-muted-foreground font-medium">{round.label}</td>
					{#each playerIds as id (id)}
						<td class="p-2.5 text-center font-mono font-medium">
							{round.scores.find((s) => s.playerId === id)?.points ?? 0}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
		<tfoot>
			<tr class="border-t-2 border-border/90 bg-muted/40 font-black">
				<td class="p-2.5 text-foreground">Total</td>
				{#each playerIds as id (id)}
					<td class="p-2.5 text-center font-mono font-black text-emerald-400">
						{totalFor(id)}
					</td>
				{/each}
			</tr>
		</tfoot>
	</table>
</div>
