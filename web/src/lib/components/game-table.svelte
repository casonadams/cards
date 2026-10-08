<script lang="ts">
	import { cn, getInitials } from '$lib/utils';
	import { Badge } from '$lib/components/ui/badge/index';
	import HandDisplay from './hand-display.svelte';
	import TrickArea from './trick-area.svelte';
	import LastTrick from './last-trick.svelte';
	import GameTableFooter from './game-table-footer.svelte';
	import OhWellBidding from './oh-well-bidding.svelte';
	import RoundScoreOverlay from './round-score-overlay.svelte';
	import { playerStatLine, teamFor, type StatContext } from './game-table-stats';
	import type { Card, RoomPlayer, PlayerStats, ScoreEntry } from '$lib/platform/types/index';
	import type { TrickPlay } from '$lib/platform/engine/index';
	import type { OhWellUiState } from '$lib/games/oh-well/ui-state';
	import type { RookUiState } from '$lib/games/rook/ui-state';

	interface Props {
		gameId: string;
		trumpSuit?: string | null;
		handType?: string;
		roundLabel: string;
		roundRules: string;
		currentRound: number;
		isMyTurn: boolean;
		myCards: readonly Card[];
		playableCards: readonly Card[];
		trickPlays: readonly TrickPlay[];
		lastCompleteTrick: readonly TrickPlay[];
		lastTrickWinnerId: string | null;
		playerNames: Record<string, string>;
		otherPlayers: readonly RoomPlayer[];
		currentTurnIndex: number;
		playerIds: readonly string[];
		allPlayerStats: readonly PlayerStats[];
		gameSpecific?: unknown;
		previousTotals: Record<string, number>;
		myId: string;
		onCardPlayed: (card: Card) => void;
		onLeave: () => void;
		showBidding?: boolean;
		onBid?: (bid: number) => void;
		isRoundComplete?: boolean;
		roundScores?: readonly ScoreEntry[] | null;
		isHost?: boolean;
		onNextRound?: () => void;
	}

	let {
		gameId,
		trumpSuit = null,
		handType = '',
		roundLabel,
		roundRules,
		currentRound,
		isMyTurn,
		myCards,
		playableCards,
		trickPlays,
		lastCompleteTrick,
		lastTrickWinnerId,
		playerNames,
		otherPlayers,
		currentTurnIndex,
		playerIds,
		allPlayerStats,
		gameSpecific,
		previousTotals,
		myId,
		onCardPlayed,
		onLeave,
		showBidding = false,
		onBid,
		isRoundComplete = false,
		roundScores = null,
		isHost = false,
		onNextRound
	}: Props = $props();

	const isOhWell = $derived(gameId === 'oh-well');
	const isRook = $derived(gameId === 'rook');
	const ohWellUi = $derived(isOhWell && gameSpecific ? (gameSpecific as OhWellUiState) : null);
	const rookUi = $derived(isRook && gameSpecific ? (gameSpecific as RookUiState) : null);
	const ctx = $derived<StatContext>({ gameId, allPlayerStats, previousTotals, ohWellUi, rookUi });
	const myTeam = $derived(teamFor(rookUi, myId));

	function isPartner(id: string): boolean {
		return myTeam !== null && teamFor(rookUi, id) === myTeam;
	}
</script>
<main class="flex-1 flex flex-col justify-between p-3 sm:p-5 max-w-6xl self-center mx-auto w-full gap-4">
	<div class="flex flex-wrap justify-center items-center gap-3 sm:gap-4 px-2 py-1 max-w-5xl mx-auto w-full shrink-0">
		{#each otherPlayers as other (other.id)}
			{@const isTurn = currentTurnIndex === playerIds.indexOf(other.id)}
			{@const team = teamFor(rookUi, other.id)}
			{@const partner = isPartner(other.id)}
			<div
				class={cn(
					'flex items-center gap-3 px-4 py-2 rounded-2xl border transition-all duration-150 text-xs sm:text-sm backdrop-blur-md shadow-sm',
					isTurn
						? 'bg-emerald-950/40 border-2 border-emerald-400 text-emerald-100 shadow-md'
						: 'bg-card/85 border-border/80 text-muted-foreground hover:border-border hover:bg-card'
				)}
			>
				<div class="relative">
					<div
						class={cn(
							'w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-black shrink-0 shadow-inner',
							isTurn ? 'bg-emerald-400 text-zinc-950 font-black' : 'bg-muted text-foreground'
						)}
					>
						{getInitials(other.displayName)}
					</div>
					{#if isTurn}
						<span class="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center pointer-events-none">
							<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
							<span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 border border-background"></span>
						</span>
					{/if}
				</div>
				<div class="flex flex-col min-w-0 leading-tight">
					<div class="flex items-center gap-1.5">
						{#if isRook && team}
							<span class="text-[10px] font-black px-1.5 py-0.2 rounded {team === 1 ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}">
								T{team}
							</span>
						{/if}
						<span
							class={cn(
								'font-bold truncate max-w-[95px] sm:max-w-[140px]',
								isTurn && 'text-emerald-300 font-extrabold',
								partner && !isTurn && 'text-foreground'
							)}
						>
							{other.displayName}
						</span>
					</div>
					<span class="text-xs font-mono text-muted-foreground/90 font-medium">
						{playerStatLine(ctx, other.id)}
					</span>
				</div>
			</div>
		{/each}
	</div>

	<!-- Centered Playing Arena -->
	<div class="flex-1 flex flex-col items-center justify-center my-auto w-full max-w-4xl mx-auto px-2 py-2 gap-3">
		{#if showBidding && ohWellUi && onBid}
			<OhWellBidding uiState={ohWellUi} {playerNames} {onBid} />
		{:else if isRoundComplete && roundScores && onNextRound}
			<TrickArea plays={trickPlays} {lastCompleteTrick} {playerNames} {gameId} {handType} {trumpSuit} isRoundComplete={true} />
			<RoundScoreOverlay
				{gameId}
				handLabel="Hand {currentRound + 1}: {roundLabel}"
				scores={roundScores}
				{playerNames}
				onContinue={onNextRound}
				{isHost}
				winnerName={lastTrickWinnerId ? (playerNames[lastTrickWinnerId] ?? '?') : null}
			/>
		{:else}
			<TrickArea plays={trickPlays} {lastCompleteTrick} {playerNames} {gameId} {handType} {trumpSuit} />
			<LastTrick
				plays={lastCompleteTrick}
				winnerName={lastTrickWinnerId ? (playerNames[lastTrickWinnerId] ?? '?') : null}
				{gameId}
			/>
		{/if}
	</div>

	<!-- Bottom Player Hand Container -->
	<div class="w-full border-t border-border/70 bg-card/40 backdrop-blur-md shrink-0 overflow-visible">
		<HandDisplay cards={myCards} playableCards={showBidding ? myCards : playableCards} {onCardPlayed} {gameId} {trumpSuit} {handType} />
	</div>
</main>

<GameTableFooter
	{isOhWell}
	{isRook}
	{myTeam}
	{ctx}
	{myId}
	{previousTotals}
	{allPlayerStats}
	onLeave={onLeave}
	{isMyTurn}
/>
