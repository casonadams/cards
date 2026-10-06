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
		hearts: 'text-rose-400 font-bold',
		diamonds: 'text-blue-400 font-bold',
		clubs: 'text-emerald-400 font-bold',
		spades: 'text-slate-200 font-bold'
	};

	const rankName = $derived(
		enemy.card.rank === 11 ? 'Jack' : enemy.card.rank === 12 ? 'Queen' : 'King'
	);
</script>

<div class="flex flex-col items-center gap-3 py-3 w-full max-w-md mx-auto">
	<div class="flex items-center gap-4 p-4 rounded-2xl bg-card/80 border border-border/80 shadow-xl backdrop-blur-md w-full">
		<div class="drop-shadow-lg shrink-0">
			<PlayingCard card={enemy.card} size="md" />
		</div>
		<div class="space-y-1.5 flex-1 min-w-0">
			<div class="flex items-center justify-between">
				<p class="text-base font-extrabold text-foreground truncate">
					{rankName} <span class={suitColors[enemy.card.suit]}>of {enemy.card.suit}</span>
				</p>
				<span class="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30">
					ATK {effectiveAttack}
				</span>
			</div>
			
			<div class="space-y-1">
				<div class="flex justify-between text-xs font-semibold">
					<span class="text-muted-foreground">Health</span>
					<span class="font-mono text-red-400">{enemy.currentHealth} / {enemy.maxHealth} HP</span>
				</div>
				<div class="w-full h-3 bg-background/80 rounded-full overflow-hidden border border-border/60 shadow-inner">
					<div class="h-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 transition-all duration-300 rounded-full" style:width="{healthPct}%"></div>
				</div>
			</div>

			<div class="flex flex-wrap items-center gap-2 pt-1 text-xs">
				<span class="text-muted-foreground font-medium">Immunity:</span>
				<span class="font-bold capitalize {suitColors[enemy.card.suit]}">
					{enemy.card.suit}
				</span>
				{#if enemy.immunityBroken}
					<span class="text-emerald-400 font-bold bg-emerald-500/15 px-1.5 py-0.5 rounded text-[10px]">
						(broken)
					</span>
				{/if}
				{#if enemy.attackReduction > 0}
					<span class="text-emerald-400 font-bold bg-emerald-500/15 px-1.5 py-0.5 rounded text-[10px]">
						(-{enemy.attackReduction} ATK)
					</span>
				{/if}
			</div>
		</div>
	</div>

	{#if (lastSuitPowers?.length ?? 0) > 0}
		<div class="flex flex-wrap gap-1.5 justify-center">
			{#each lastSuitPowers as power (power)}
				<Badge variant="outline" class="text-xs px-2.5 py-0.5 bg-background/60">{power}</Badge>
			{/each}
		</div>
	{/if}
</div>
