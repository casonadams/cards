<script lang="ts">
	import RoundScoreOverlay from './round-score-overlay.svelte';
	import GameOverOverlay from './game-over-overlay.svelte';
	import type { ScoreEntry } from '$lib/platform/types/index';
	import type { RoundScore } from '$lib/platform/stores/room-store';

	interface Props {
		isRoundComplete: boolean;
		isGameOver: boolean;
		roundScores: readonly ScoreEntry[] | null;
		handLabel: string;
		playerNames: Record<string, string>;
		playerIds: readonly string[];
		allRounds: readonly RoundScore[];
		isHost: boolean;
		onNextRound: () => void;
		onBackToLobby: () => void;
	}

	let {
		isRoundComplete,
		isGameOver,
		roundScores,
		handLabel,
		playerNames,
		playerIds,
		allRounds,
		isHost,
		onNextRound,
		onBackToLobby
	}: Props = $props();
</script>

{#if isRoundComplete && !isGameOver && roundScores}
	<RoundScoreOverlay
		{handLabel}
		scores={roundScores}
		{playerNames}
		onContinue={onNextRound}
		{isHost}
	/>
{/if}

{#if isGameOver && roundScores}
	<GameOverOverlay {playerNames} {playerIds} rounds={allRounds} {onBackToLobby} />
{/if}
