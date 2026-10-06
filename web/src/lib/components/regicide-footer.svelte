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

<footer class="border-t border-border px-4 py-2 flex justify-between items-center">
	<Button variant="ghost" size="sm" onclick={onLeave}>Leave</Button>
	<div class="flex gap-2">
		{#if uiState.canPlay}
			<Button variant="secondary" size="sm" onclick={onYield}>Yield</Button>
			<Button size="sm" onclick={onPlay} disabled={!validCombo}>
				{validCombo ? `Attack (${attackValue})` : 'Select cards'}
			</Button>
		{:else if uiState.isDefending}
			<Button size="sm" onclick={onDefend} disabled={!canDefend}>
				Defend ({defenseValue})
			</Button>
		{/if}
	</div>
</footer>
