<script lang="ts">
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

<nav class="border-b border-border px-4 py-2 flex justify-between items-center gap-2">
	<h1 class="text-sm font-bold whitespace-nowrap">Garden Salad</h1>
	<button class="cursor-pointer" onclick={() => (showRules = !showRules)}>
		<Badge variant="outline" class="whitespace-nowrap text-center">
			Hand {currentRound + 1}: {roundLabel}
		</Badge>
	</button>
	{#if isMyTurn}<Badge variant="success" class="whitespace-nowrap">Your Turn</Badge>
	{:else}<Badge variant="secondary" class="whitespace-nowrap">Waiting...</Badge>{/if}
</nav>

{#if showRules}
	<div class="bg-muted/50 border-b border-border px-4 py-2 text-xs text-muted-foreground">
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

<main class="flex-1 flex flex-col justify-between p-2">
	<div class="flex flex-wrap justify-center gap-x-4 gap-y-1 px-1 py-1">
		{#each otherPlayers as other (other.id)}
			{@const isTurn = currentTurnIndex === playerIds.indexOf(other.id)}
			{@const team = teamFor(rookUi, other.id)}
			{@const partner = isPartner(other.id)}
			<div class="flex flex-col items-center min-w-[60px]">
				<span class="flex items-center gap-1">
					{#if isRook && team}
						<span class="text-[9px] font-bold {team === 1 ? 'text-blue-400' : 'text-amber-400'}"
							>T{team}</span
						>
					{/if}
					<span
						class="text-xs truncate max-w-[70px] sm:max-w-[100px]"
						class:text-success={isTurn}
						class:text-muted-foreground={!isTurn && !partner}
						class:text-foreground={partner && !isTurn}>{other.displayName}</span
					>
				</span>
				<span class="text-[10px] text-muted-foreground">{playerStatLine(ctx, other.id)}</span>
			</div>
		{/each}
	</div>

	<TrickArea plays={trickPlays} {lastCompleteTrick} {playerNames} {gameId} {handType} {trumpSuit} />
	<LastTrick
		plays={lastCompleteTrick}
		winnerName={lastTrickWinnerId ? (playerNames[lastTrickWinnerId] ?? '?') : null}
		{gameId}
	/>

	<div class="border-t border-border pt-1">
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
	{onLeave}
/>
