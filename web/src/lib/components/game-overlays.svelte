<script lang="ts">
	import GameOverOverlay from './game-over-overlay.svelte';
	import type { ScoreEntry } from '$lib/platform/types/index';
	import type { RoundScore } from '$lib/platform/stores/room-store';

	interface Props {
		gameId?: string;
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
		gameId = '',
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


{#if isGameOver && roundScores}
	<GameOverOverlay {gameId} {playerNames} {playerIds} rounds={allRounds} {onBackToLobby} />
{/if}
