<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index';
	import PlayingCard from './playing-card.svelte';
	import type { Enemy } from '$lib/games/regicide/index';

	interface Props {
		enemy: Enemy;
		healthPct: number;
		effectiveAttack: number;
		lastSuitPowers: readonly string[];
	}

	let { enemy, healthPct, effectiveAttack, lastSuitPowers }: Props = $props();

	const suitColors: Record<string, string> = {
		hearts: 'text-red-300',
		diamonds: 'text-amber-300',
		clubs: 'text-sky-300',
		spades: 'text-slate-300'
	};

	const rankName = $derived(
		enemy.card.rank === 11 ? 'Jack' : enemy.card.rank === 12 ? 'Queen' : 'King'
	);
</script>

<div class="flex flex-col items-center gap-2 py-4">
	<div class="flex items-center gap-3">
		<PlayingCard card={enemy.card} size="md" />
		<div class="space-y-1">
			<p class="text-sm font-bold">
				{rankName}
				<span class={suitColors[enemy.card.suit]}> of {enemy.card.suit}</span>
			</p>
			<div class="w-32 h-3 bg-muted rounded-full overflow-hidden">
				<div class="h-full bg-red-500 transition-all duration-300" style:width="{healthPct}%"></div>
			</div>
			<p class="text-xs text-muted-foreground">
				HP: {enemy.currentHealth}/{enemy.maxHealth}
			</p>
			<p class="text-xs text-muted-foreground">
				Attack: {effectiveAttack}
				{#if enemy.attackReduction > 0}
					<span class="text-green-400">(-{enemy.attackReduction})</span>
				{/if}
			</p>
			<p class="text-[10px] text-muted-foreground">
				Immune to: <span class={suitColors[enemy.card.suit]}>{enemy.card.suit}</span>
				{#if enemy.immunityBroken}<span class="text-green-400"> (broken)</span>{/if}
			</p>
		</div>
	</div>

	{#if (lastSuitPowers?.length ?? 0) > 0}
		<div class="flex flex-wrap gap-1 justify-center">
			{#each lastSuitPowers as power (power)}
				<Badge variant="outline" class="text-[10px]">{power}</Badge>
			{/each}
		</div>
	{/if}
</div>
