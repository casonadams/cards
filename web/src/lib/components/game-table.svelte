<script lang="ts">
	import { cn, getInitials, getFirstName } from '$lib/utils';
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

	const leaderId = $derived(
		trickPlays.length > 0
			? trickPlays[0].playerId
			: (playerIds[currentTurnIndex] ?? playerIds[0])
	);

	const orderedPlayerIds = $derived.by(() => {
		const leadIndex = playerIds.indexOf(leaderId);
		if (leadIndex <= 0) return playerIds;
		return [...playerIds.slice(leadIndex), ...playerIds.slice(0, leadIndex)];
	});

	function isPartner(id: string): boolean {
		return myTeam !== null && teamFor(rookUi, id) === myTeam;
	}
</script>
<main class="flex-1 flex flex-col justify-between p-3 sm:p-5 max-w-6xl self-center mx-auto w-full gap-4">
	<div class="flex flex-wrap justify-center items-center gap-2 sm:gap-3 px-2 py-1 max-w-5xl mx-auto w-full shrink-0">
		{#each orderedPlayerIds as id, pos (id)}
			{@const isMe = id === myId}
			{@const displayName = playerNames[id] ?? id}
			{@const shortName = getFirstName(displayName)}
			{@const isTurn = currentTurnIndex === playerIds.indexOf(id)}
			{@const team = teamFor(rookUi, id)}
			{@const partner = isPartner(id)}
			{@const isLeader = pos === 0}
			{@const isLast = pos === orderedPlayerIds.length - 1}
			<div
				class={cn(
					'flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3.5 py-1.5 rounded-2xl border transition-all duration-150 text-xs sm:text-sm backdrop-blur-md shadow-sm',
					isTurn
						? 'bg-emerald-950/60 border-2 border-emerald-400 text-emerald-100 shadow-md ring-1 ring-emerald-500/40'
						: isMe
							? 'bg-card/95 border-emerald-500/40 text-foreground shadow-xs'
							: 'bg-card/85 border-border/80 text-muted-foreground hover:border-border hover:bg-card'
				)}
			>
				<div class="relative">
					<div
						class={cn(
							'w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-black shrink-0 shadow-inner',
							isTurn
								? 'bg-emerald-400 text-zinc-950 font-black'
								: isMe
									? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
									: 'bg-muted text-foreground'
						)}
					>
						{getInitials(displayName)}
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
								'text-[9px] font-black px-1.5 py-0.2 rounded leading-none border',
								isLeader
									? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
									: isLast
										? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
										: 'bg-muted/80 text-muted-foreground border-border/60'
							)}
							title={isLeader ? 'Leader (plays 1st)' : isLast ? `Last (plays ${orderedPlayerIds.length})` : `Plays ${pos + 1}`}
						>
							{isLeader ? '1st' : isLast ? 'Last' : `${pos + 1}`}
						</span>
						<span
							class={cn(
								'font-bold truncate max-w-[70px] sm:max-w-[120px]',
								isTurn && 'text-emerald-300 font-extrabold',
								isMe && !isTurn && 'text-foreground font-extrabold',
								partner && !isTurn && 'text-foreground'
							)}
							title={displayName}
						>
							{shortName}
						</span>
						{#if isMe}
							<span class="text-[10px] text-emerald-400 font-black px-1.5 py-0.2 rounded-full bg-emerald-500/15 border border-emerald-500/30 leading-none">
								You
							</span>
						{/if}
					</div>
					<span class="text-[11px] sm:text-xs font-mono text-muted-foreground/90 font-medium">
						{playerStatLine(ctx, id)}
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

	<!-- Bottom Player Hand Container with anchored absolute Your Turn banner -->
	<div class="w-full border-t border-border/70 bg-card/40 backdrop-blur-md shrink-0 overflow-visible relative">
		{#if isMyTurn && !showBidding && !isRoundComplete}
			<div class="absolute -top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none transition-all duration-200 animate-in fade-in zoom-in-95">
				<div class="inline-flex items-center gap-2 px-4 sm:px-5 py-1 sm:py-1.5 rounded-full bg-emerald-950/95 border-2 border-emerald-400 text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.5)] backdrop-blur-md animate-pulse whitespace-nowrap">
					<span class="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm"></span>
					<span class="font-black text-xs sm:text-sm tracking-wider uppercase">Your Turn — Play a Card</span>
				</div>
			</div>
		{/if}
		<HandDisplay
			cards={myCards}
			playableCards={showBidding ? [] : playableCards}
			onCardPlayed={showBidding ? undefined : onCardPlayed}
			interactive={!showBidding}
			inspection={showBidding}
			{gameId}
			{trumpSuit}
			{handType}
		/>
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
