<script lang="ts">
	import GameTable from './game-table.svelte';
	import GameOverlays from './game-overlays.svelte';
	import type { Card, RoomPlayer } from '$lib/platform/types/index';
	import type { DerivedGameState } from '$lib/platform/stores/game-store';
	import type { RoundScore } from '$lib/platform/stores/room-store';

	interface Props {
		gameId: string;
		trumpSuit?: string | null;
		gs: DerivedGameState;
		currentRound: number;
		roundLabel: string;
		roundRules: string;
		playerNames: Record<string, string>;
		playerIds: readonly string[];
		otherPlayers: readonly RoomPlayer[];
		allPlayers?: readonly RoomPlayer[];
		isHost: boolean;
		myId: string;
		allRounds: readonly RoundScore[];
		onCardPlayed: (card: Card) => void;
		onNextRound: () => void;
		onBackToLobby: () => void;
		onLeave: () => void;
		showBidding?: boolean;
		onBid?: (bid: number) => void;
	}

	let {
		gameId,
		trumpSuit = null,
		gs,
		currentRound,
		roundLabel,
		roundRules,
		playerNames,
		playerIds,
		otherPlayers,
		allPlayers = otherPlayers,
		isHost,
		myId,
		allRounds,
		onCardPlayed,
		onNextRound,
		onBackToLobby,
		onLeave,
		showBidding = false,
		onBid
	}: Props = $props();

	const prevTotals = $derived(
		Object.fromEntries(
			playerIds.map((id) => [
				id,
				allRounds.reduce(
					(sum, r) => sum + (r.scores.find((s) => s.playerId === id)?.points ?? 0),
					0
				)
			])
		)
	);

	let showFinalStandings = $state(false);
</script>
<GameTable
	{gameId}
	{trumpSuit}
	handType={gs.handType}
	{roundLabel}
	{roundRules}
	{currentRound}
	isMyTurn={gs.isMyTurn}
	myCards={gs.myRemainingHand}
	playableCards={gs.playableCards}
	trickPlays={gs.trickPlays}
	lastCompleteTrick={gs.lastCompleteTrick}
	lastTrickWinnerId={gs.lastTrickWinnerId}
	{playerNames}
	{otherPlayers}
	{allPlayers}
	currentTurnIndex={gs.currentTurnIndex}
	{playerIds}
	allPlayerStats={gs.allPlayerStats}
	gameSpecific={gs.gameSpecific}
	{myId}
	previousTotals={prevTotals}
	{onCardPlayed}
	{onLeave}
	{showBidding}
	{onBid}
	isRoundComplete={gs.isRoundComplete}
	isGameOver={gs.isGameOver}
	roundScores={gs.roundScores}
	{isHost}
	{onNextRound}
	onShowGameOver={() => (showFinalStandings = true)}
/>
<GameOverlays
	{gameId}
	isRoundComplete={gs.isRoundComplete}
	isGameOver={gs.isGameOver && showFinalStandings}
	roundScores={gs.roundScores}
	handLabel="Hand {currentRound + 1}: {roundLabel}"
	{playerNames}
	{playerIds}
	{isHost}
	{allRounds}
	{onNextRound}
	{onBackToLobby}
/>
