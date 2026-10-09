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
	import { isAiPlayer } from '$lib/platform/engine/ai-player';
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
		allPlayers?: readonly RoomPlayer[];
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
		isGameOver?: boolean;
		roundScores?: readonly ScoreEntry[] | null;
		isHost?: boolean;
		onNextRound?: () => void;
		onShowGameOver?: () => void;
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
		allPlayers = otherPlayers,
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
		isGameOver = false,
		roundScores = null,
		isHost = false,
		onNextRound,
		onShowGameOver
	}: Props = $props();

	const isOhWell = $derived(gameId === 'oh-well');
	const isRook = $derived(gameId === 'rook');
	const ohWellUi = $derived(isOhWell && gameSpecific ? (gameSpecific as OhWellUiState) : null);
	const rookUi = $derived(isRook && gameSpecific ? (gameSpecific as RookUiState) : null);
	const ctx = $derived<StatContext>({ gameId, allPlayerStats, previousTotals, ohWellUi, rookUi });
	const myTeam = $derived(teamFor(rookUi, myId));

	const initialLeaderId = $derived.by(() => {
		if (isOhWell && ohWellUi?.leaderId) {
			return ohWellUi.leaderId;
		}
		const dealerIdx = currentRound % playerIds.length;
		const leaderIdx = (dealerIdx + 1) % playerIds.length;
		return playerIds[leaderIdx] ?? playerIds[0];
	});

	const leaderId = $derived.by(() => {
		if (showBidding) {
			return initialLeaderId;
		}
		if (trickPlays.length > 0) {
			return trickPlays[0].playerId;
		}
		return lastTrickWinnerId ?? initialLeaderId;
	});

	let roundScoreReady = $state(false);

	$effect(() => {
		if (!isRoundComplete) {
			roundScoreReady = false;
		}
	});

	$effect(() => {
		if (isRoundComplete && !roundScoreReady) {
			const fallback = setTimeout(() => {
				roundScoreReady = true;
			}, 3600);
			return () => clearTimeout(fallback);
		}
	});

	function isPartner(id: string): boolean {
		return myTeam !== null && teamFor(rookUi, id) === myTeam;
	}
</script>

{#if isMyTurn && !isRoundComplete}
	<div
		class="fixed inset-0 pointer-events-none z-50 transition-opacity duration-300 turn-glow-border"
		aria-hidden="true"
	></div>
{/if}

<main class="flex-1 min-h-0 flex flex-col justify-between p-1.5 sm:tall:p-4 max-w-6xl self-center mx-auto w-full gap-1 sm:tall:gap-2.5 overflow-hidden">
	<div class="flex flex-wrap justify-center items-center gap-1 sm:tall:gap-2 px-1 py-0.5 max-w-5xl mx-auto w-full shrink-0">
		{#each playerIds as id (id)}
			{@const isMe = id === myId}
			{@const displayName = playerNames[id] ?? id}
			{@const shortName = getFirstName(displayName)}
			{@const playerIndex = playerIds.indexOf(id)}
			{@const isTurn = currentTurnIndex === playerIndex}
			{@const team = teamFor(rookUi, id)}
			{@const partner = isPartner(id)}
			{@const leadIndex = playerIds.indexOf(leaderId)}
			{@const trickOrder = ((playerIndex - leadIndex + playerIds.length) % playerIds.length) + 1}
			{@const isLeader = trickOrder === 1}
			{@const playerObj = (allPlayers ?? otherPlayers).find((p) => p.id === id)}
			{@const isRealAi = isAiPlayer(id)}
			{@const isAi = isRealAi || Boolean(playerObj?.isAiControlled && !playerObj?.isConnected)}
			{@const isDisconnected = !isRealAi && playerObj !== undefined && !playerObj.isConnected}
			<div
				data-player-id={id}
				data-is-ai={isAi ? "true" : undefined}
				data-is-disconnected={isDisconnected ? "true" : undefined}
				class={cn(
					'flex items-center gap-1 sm:tall:gap-2 px-1.5 sm:tall:px-3 py-0.5 sm:tall:py-1 rounded-xl sm:tall:rounded-2xl border-2 transition-colors duration-150 text-[10px] sm:tall:text-xs backdrop-blur-md shadow-xs shrink-0',
					isDisconnected
						? isTurn
							? 'bg-amber-950/60 border-2 border-dashed border-amber-300 text-amber-100 shadow-[0_0_12px_rgba(251,191,36,0.3)] ring-1 ring-amber-400/50'
							: 'bg-amber-950/30 border-2 border-dashed border-amber-400 text-amber-200 shadow-amber-950/30'
						: isAi
							? isTurn
								? 'bg-blue-950/70 border-2 border-blue-400 text-blue-100 shadow-[0_0_12px_rgba(96,165,250,0.3)] ring-1 ring-blue-400/50'
								: 'bg-blue-950/40 border-2 border-blue-500 text-blue-200'
							: isTurn
								? 'bg-emerald-950/60 border-2 border-emerald-400 text-emerald-100 shadow-[0_0_12px_rgba(52,211,153,0.3)] ring-1 ring-emerald-400/50'
								: isMe
									? 'bg-card/95 border-2 border-emerald-500/60 text-foreground shadow-xs ring-1 ring-emerald-500/25'
									: 'bg-card/90 border-2 border-emerald-500/35 text-foreground hover:border-emerald-500/50 hover:bg-card'
				)}
			>
				<div class="relative">
					<div
						class={cn(
							'w-6 h-6 sm:tall:w-8 sm:tall:h-8 rounded-full flex items-center justify-center text-[10px] sm:tall:text-xs font-black shrink-0 shadow-inner border transition-colors duration-150',
							isDisconnected
								? 'bg-amber-500/20 text-amber-300 border-2 border-dashed border-amber-400'
								: isAi
									? isTurn
										? 'bg-blue-400 text-zinc-950 border-blue-400'
										: 'bg-blue-500/20 text-blue-300 border-blue-500/40'
									: isTurn
										? 'bg-emerald-400 text-zinc-950 border-emerald-400'
										: isMe
											? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50'
											: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
						)}
					>
						{getInitials(displayName)}
					</div>
					{#if isTurn}
						<div class="absolute -top-1 -right-1 flex h-3.5 w-3.5 sm:tall:h-4 sm:tall:w-4 items-center justify-center pointer-events-none">
							<span class="animate-ping absolute inline-flex h-full w-full rounded-full {isDisconnected ? 'bg-amber-400' : isAi ? 'bg-blue-400' : 'bg-emerald-400'} opacity-75"></span>
							<span class="relative inline-flex items-center justify-center h-3.5 w-3.5 sm:tall:h-4 sm:tall:w-4 rounded-full {isDisconnected ? 'bg-amber-400' : isAi ? 'bg-blue-400' : 'bg-emerald-400'} text-zinc-950 font-black text-[9px] sm:tall:text-[10px] border border-background shadow-xs animate-pulse" title="Current Turn (Plays #{trickOrder})">
								{trickOrder}
							</span>
						</div>
					{:else if isLeader}
						<span class="absolute -top-1 -right-1 h-3.5 w-3.5 sm:tall:h-4 sm:tall:w-4 rounded-full bg-amber-500 text-amber-950 flex items-center justify-center text-[9px] sm:tall:text-[10px] font-black border border-background shadow-xs pointer-events-none" title="Leader (Plays 1st)">
							1
						</span>
					{:else}
						<span class="absolute -top-1 -right-1 h-3.5 w-3.5 sm:tall:h-4 sm:tall:w-4 rounded-full bg-muted/90 text-foreground/80 flex items-center justify-center text-[9px] sm:tall:text-[10px] font-black border border-background/80 shadow-xs pointer-events-none" title="Plays #{trickOrder}">
							{trickOrder}
						</span>
					{/if}
				</div>
				<div class="flex flex-col min-w-0 leading-tight">
					<div class="flex items-center gap-1">
						{#if isRook && team}
							<span class="text-[9px] font-black px-1 py-0.2 rounded {team === 1 ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}">
								T{team}
							</span>
						{/if}
						<span
							class={cn(
								'font-bold truncate max-w-[55px] sm:tall:max-w-[120px] transition-colors duration-150 text-[10px] sm:tall:text-xs',
								isDisconnected
									? 'text-amber-200'
									: isAi
										? 'text-blue-300'
										: isTurn
											? 'text-emerald-300 font-extrabold'
											: isMe
												? 'text-foreground font-bold'
												: partner
													? 'text-foreground font-bold'
													: 'text-foreground/90 font-medium'
							)}
							title={displayName}
						>
							{shortName}
						</span>
					</div>
					<span class="text-[9px] sm:tall:text-[11px] font-mono text-muted-foreground/90 font-medium tabular-nums">
						<span class="sm:tall:hidden">{playerStatLine(ctx, id, true)}</span>
						<span class="hidden sm:tall:inline">{playerStatLine(ctx, id, playerIds.length >= 6)}</span>
					</span>
				</div>
			</div>
		{/each}
	</div>

	<!-- Centered Playing Arena -->
	<div class="flex-1 min-h-0 flex flex-col items-center justify-center my-auto w-full max-w-4xl mx-auto px-1 sm:tall:px-2 py-0.5 sm:tall:py-1 gap-1 sm:tall:gap-2 overflow-hidden">
		{#if showBidding && ohWellUi && onBid}
			<OhWellBidding uiState={ohWellUi} {playerNames} {onBid} />
		{:else if isRoundComplete && roundScores && roundScoreReady}
			<RoundScoreOverlay
				{gameId}
				handLabel="Hand {currentRound + 1}: {roundLabel}"
				scores={roundScores}
				{playerNames}
				onContinue={isGameOver ? (onShowGameOver ?? onNextRound ?? (() => {})) : (onNextRound ?? (() => {}))}
				{isHost}
				{isGameOver}
				winnerName={lastTrickWinnerId ? (playerNames[lastTrickWinnerId] ?? '?') : null}
			/>
		{:else}
			<TrickArea
				plays={trickPlays}
				{lastCompleteTrick}
				{playerNames}
				{gameId}
				{handType}
				{trumpSuit}
				winnerId={lastTrickWinnerId}
				winnerName={lastTrickWinnerId ? (playerNames[lastTrickWinnerId] ?? '?') : null}
				{myId}
				isRoundComplete={isRoundComplete}
				onCollectComplete={() => (roundScoreReady = true)}
			/>
			<div class="h-6 min-h-[24px] sm:tall:h-7 sm:tall:min-h-[28px] flex items-center justify-center shrink-0 w-full">
				<LastTrick
					plays={lastCompleteTrick}
					winnerName={lastTrickWinnerId ? (playerNames[lastTrickWinnerId] ?? '?') : null}
					{gameId}
				/>
			</div>
			<!-- Turn Banner centered between Last Trick bar and cards dock -->
			<div class="h-9 min-h-[36px] sm:tall:h-11 sm:tall:min-h-[44px] flex items-center justify-center shrink-0 w-full z-30 transition-all duration-200">
				{#if isMyTurn && !showBidding && !isRoundComplete}
					<div class="inline-flex items-center gap-2 sm:gap-3 px-5 sm:tall:px-7 py-1 sm:tall:py-1.5 rounded-full bg-emerald-950/95 border-2 border-emerald-400 text-emerald-200 shadow-[0_0_28px_rgba(16,185,129,0.7)] backdrop-blur-md animate-pulse whitespace-nowrap">
						<span class="relative flex h-2.5 w-2.5 sm:h-3 sm:w-3">
							<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
							<span class="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-emerald-400 shadow-[0_0_8px_#34d399]"></span>
						</span>
						<span class="font-black text-xs sm:tall:text-sm md:text-base tracking-wider uppercase drop-shadow-sm">
							Your Turn — Play a Card
						</span>
						<span class="relative flex h-2.5 w-2.5 sm:h-3 sm:w-3">
							<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
							<span class="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-emerald-400 shadow-[0_0_8px_#34d399]"></span>
						</span>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Bottom Player Hand Container (Full-Width Card Dock) -->
	<div class="-mx-1.5 sm:tall:-mx-4 w-[calc(100%+0.75rem)] sm:tall:w-[calc(100%+2rem)] border-t border-emerald-500/25 bg-card/50 backdrop-blur-md shadow-[0_-4px_16px_rgba(0,0,0,0.3)] shrink-0 overflow-visible relative h-[88px] sm:tall:h-[130px] flex flex-col justify-end">
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
