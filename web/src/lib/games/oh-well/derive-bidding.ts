import { dealOhWell } from './deal.ts';
import { computeHookBid } from './derive-helpers.ts';
import { scoreRound } from './scoring.ts';
import { getTotalRounds } from './types.ts';
import { countTricksTaken } from './trick-counting.ts';
import type { DeriveParams, DerivedState } from '$lib/platform/types/game-runtime';
import type { OhWellUiState } from './ui-state.ts';
import type { OhWellRoundState } from './types.ts';

function isBiddingPhase(rs: OhWellRoundState): boolean {
	return rs.phase === 'bidding';
}

function computeCanBid(rs: OhWellRoundState, myIndex: number): boolean {
	return isBiddingPhase(rs) && rs.currentBidder === myIndex;
}

function computeHookBidValue(rs: OhWellRoundState, playerCount: number): number | null {
	if (!isBiddingPhase(rs)) return null;
	if (rs.bids.length !== playerCount - 1) return null;
	return computeHookBid(rs);
}

function getTricksTakenMap(params: DeriveParams, rs: OhWellRoundState): Map<string, number> {
	return rs.phase === 'playing'
		? countTricksTaken(params, rs.trumpSuit)
		: new Map<string, number>();
}

export function buildUiState(params: DeriveParams, rs: OhWellRoundState): OhWellUiState {
	const deal = dealOhWell({
		playerCount: params.playerCount,
		cardsPerPlayer: rs.cardsPerPlayer,
		seed: params.seed + params.currentRound
	});
	const myIndex = params.playerIds.indexOf(params.myId);
	return {
		phase: rs.phase,
		trumpSuit: rs.trumpSuit,
		trumpCard: deal.trumpCard,
		bids: rs.bids,
		cardsPerPlayer: rs.cardsPerPlayer,
		canBid: computeCanBid(rs, myIndex),
		hookBid: computeHookBidValue(rs, params.playerCount),
		tricksTaken: Object.fromEntries(getTricksTakenMap(params, rs))
	};
}

export function buildHandLabel(rs: OhWellRoundState): string {
	if (isBiddingPhase(rs)) return `Bidding (${rs.cardsPerPlayer} cards)`;
	return rs.trumpSuit ? `Trump: ${rs.trumpSuit}` : 'No Trump';
}

export interface EndOfRoundParams {
	readonly params: DeriveParams;
	readonly rs: OhWellRoundState;
	readonly isRoundComplete: boolean;
}

export function computeEndRoundScores(eor: EndOfRoundParams): DerivedState['roundScores'] {
	if (!eor.isRoundComplete) return null;
	return scoreRound(eor.rs.bids, countTricksTaken(eor.params, eor.rs.trumpSuit));
}

export function isGameOver(eor: EndOfRoundParams): boolean {
	return (
		eor.isRoundComplete && eor.params.currentRound >= getTotalRounds(eor.params.playerCount) - 1
	);
}

export function biddingDefaults(rs: OhWellRoundState, myIndex: number): Partial<DerivedState> {
	return {
		trickPlays: [],
		lastCompleteTrick: [],
		lastTrickWinnerId: null,
		currentTurnIndex: rs.currentBidder,
		isMyTurn: rs.currentBidder === myIndex,
		playableCards: [],
		isRoundComplete: false,
		allPlayerStats: [],
		roundScores: null,
		isGameOver: false
	};
}
