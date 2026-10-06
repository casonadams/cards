<script lang="ts">
	import { Button } from '$lib/components/ui/button/index';
	import type { RegicideUiState } from '$lib/games/regicide/ui-state';

	interface Props {
		uiState: RegicideUiState;
		validCombo: boolean;
		attackValue: number;
		defenseValue: number;
		canDefend: boolean;
		onPlay: () => void;
		onYield: () => void;
		onDefend: () => void;
		onLeave: () => void;
	}

	let {
		uiState,
		validCombo,
		attackValue,
		defenseValue,
		canDefend,
		onPlay,
		onYield,
		onDefend,
		onLeave
	}: Props = $props();
</script>

<footer class="border-t border-border/80 bg-card/60 backdrop-blur-md px-4 py-2.5 flex justify-between items-center text-xs">
	<Button
		variant="ghost"
		size="sm"
		class="text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs h-9 px-3"
		onclick={onLeave}
	>
		← Leave Game
	</Button>
	<div class="flex items-center gap-2">
		{#if uiState.canPlay}
			<Button variant="secondary" size="sm" class="text-xs h-9 px-3.5 font-semibold" onclick={onYield}>
				Yield (Draw 1)
			</Button>
			<Button
				size="sm"
				class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 px-4 shadow-sm"
				onclick={onPlay}
				disabled={!validCombo}
			>
				{validCombo ? `⚔ Attack (${attackValue})` : 'Select Cards'}
			</Button>
		{:else if uiState.isDefending}
			<Button
				size="sm"
				class="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs h-9 px-4 shadow-sm"
				onclick={onDefend}
				disabled={!canDefend}
			>
				🛡 Defend ({defenseValue})
			</Button>
		{/if}
	</div>
</footer>
