<script lang="ts">
	import { cn } from '$lib/utils';
	import { Badge } from '$lib/components/ui/badge/index';
	import HandDisplay from './hand-display.svelte';
	import TrickArea from './trick-area.svelte';
	import LastTrick from './last-trick.svelte';
	import GameTableFooter from './game-table-footer.svelte';
	import { playerStatLine, teamFor, type StatContext } from './game-table-stats';
	import CanadianSaladPenalties from './canadian-salad-penalties.svelte';
	import OhWellTrumpBanner from './oh-well-trump-banner.svelte';
	import type { Card, RoomPlayer, PlayerStats } from '$lib/platform/types/index';
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
		onLeave
	}: Props = $props();

	let showRules = $state(false);
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

<div class="border-b border-border/80 bg-card/60 backdrop-blur-md px-4 sm:px-6 py-3 flex justify-between items-center gap-3">
	<div class="flex items-center gap-2">
		<button
			class="cursor-pointer inline-flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
			onclick={() => (showRules = !showRules)}
			title="Click to view hand rules"
		>
			<Badge variant="outline" class="whitespace-nowrap font-bold text-xs sm:text-sm py-1.5 px-4 bg-background/50 hover:bg-accent border-border/80 shadow-xs">
				<span class="opacity-70">Hand {currentRound + 1}:</span>
				<span class="font-extrabold ml-1">{roundLabel}</span>
				<span class="text-xs ml-1 opacity-70">ⓘ</span>
			</Badge>
		</button>
	</div>

	<div class="flex items-center gap-2">
		{#if isMyTurn}
			<Badge variant="success" class="whitespace-nowrap px-4 py-1.5 text-xs sm:text-sm font-black shadow-md shadow-emerald-500/20">
				<span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 mr-2 animate-pulse"></span>
				Your Turn
			</Badge>
		{:else}
			<Badge variant="secondary" class="whitespace-nowrap px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-muted-foreground bg-secondary/60">
				Waiting for turn...
			</Badge>
		{/if}
	</div>
</div>
{#if showRules}
	<div class="bg-muted/50 border-b border-border px-6 py-3 text-xs sm:text-sm text-muted-foreground">
		{roundRules}
	</div>
{/if}

{#if gameId === 'canadian-salad' && handType}
	<CanadianSaladPenalties {handType} />
{/if}

{#if gameId === 'oh-well' && ohWellUi}
	<OhWellTrumpBanner trumpSuit={ohWellUi.trumpSuit} trumpCard={ohWellUi.trumpCard} />
{/if}

{#if rookUi}
	<div
		class="border-b border-border px-4 py-1 flex justify-between items-center text-xs text-muted-foreground"
	>
		<span>
			Bid: <span class="text-foreground font-medium">{rookUi.highBid}</span> by {playerNames[
				rookUi.highBidderName
			] ?? rookUi.highBidderName}
		</span>
		{#if rookUi.trumpColor}
			<Badge variant="warning" class="capitalize py-0 text-[10px] font-bold">
				Trump: {rookUi.trumpColor}
			</Badge>
		{/if}
		<span>
			<span class="text-blue-400">T1: {rookUi.team1Score}</span>
			|
			<span class="text-amber-400">T2: {rookUi.team2Score}</span>
		</span>
	</div>
{/if}

<main class="flex-1 flex flex-col justify-between p-3 sm:p-5 max-w-6xl self-center mx-auto w-full gap-4">
	<div class="flex flex-wrap justify-center items-center gap-3 sm:gap-4 px-2 py-1 max-w-5xl mx-auto w-full shrink-0">
		{#each otherPlayers as other (other.id)}
			{@const isTurn = currentTurnIndex === playerIds.indexOf(other.id)}
			{@const team = teamFor(rookUi, other.id)}
			{@const partner = isPartner(other.id)}
			<div
				class={cn(
					'flex items-center gap-3 px-4 py-2 rounded-2xl border transition-all duration-200 text-xs sm:text-sm backdrop-blur-md shadow-md',
					isTurn
						? 'bg-emerald-500/20 border-emerald-500/70 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.35)] ring-2 ring-emerald-500/50 scale-105'
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
						{other.displayName.slice(0, 2).toUpperCase()}
					</div>
					{#if isTurn}
						<span class="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-background animate-ping"></span>
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
		<TrickArea plays={trickPlays} {lastCompleteTrick} {playerNames} {gameId} {handType} {trumpSuit} />
		<LastTrick
			plays={lastCompleteTrick}
			winnerName={lastTrickWinnerId ? (playerNames[lastTrickWinnerId] ?? '?') : null}
			{gameId}
		/>
	</div>

	<!-- Bottom Player Hand Container -->
	<div class="w-full border-t border-border/70 bg-card/40 backdrop-blur-md shrink-0 overflow-visible">
		<HandDisplay cards={myCards} {playableCards} {onCardPlayed} {gameId} {trumpSuit} {handType} />
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
/>
