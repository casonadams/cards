import { dealRook } from './deal.ts';
import { cardToRook, rookToCard } from './card-adapter.ts';
import { resolveRookTrick } from './trick.ts';
import { sumPoints } from './scoring.ts';
import { parseRookState } from './parse-state.ts';
import { buildRookUiState } from './build-ui-state.ts';
import { computeRoundEnd } from './round-end.ts';
import { getMyRookHand, computeLeader, computePlayerStats } from './derive-helpers.ts';
import { getTrickPlays, getLastTrick, getPlayableCards } from './trick-query.ts';
import { getTurnIndex, deriveBiddingState } from './derive-bidding-state.ts';
import type { DeriveParams, DerivedState } from '$lib/platform/types/game-runtime';
import type { RookRoundState, RookColor } from './types.ts';

function resolveLastTrickWinner(params: DeriveParams, trump: RookColor): string | null {
	const lastTrick = getLastTrick(params);
	if (lastTrick.length === 0) return null;
	const plays = lastTrick.map((p) => ({ playerId: p.playerId, card: cardToRook(p.card) }));
	return resolveRookTrick(plays, trump).winnerId;
}

function getCardsPerPlayer(params: DeriveParams): number {
	const deal = dealRook(params.playerCount, params.seed + params.currentRound);
	return deal.hands[0]?.length ?? 10;
}

interface EndStateInput {
	readonly params: DeriveParams;
	readonly rs: RookRoundState;
	readonly isRoundComplete: boolean;
	readonly lastWinnerId: string | null;
}

function resolveEndState(input: EndStateInput) {
	if (!input.isRoundComplete) return { roundScores: null, isGameOver: false };
	return computeRoundEnd({
		params: input.params,
		rs: input.rs,
		nestPoints: sumPoints(input.rs.discardedNest),
		lastWinnerId: input.lastWinnerId
	});
}

function computePlayCore(input: { params: DeriveParams; rs: RookRoundState; myIndex: number }) {
	const { params, rs, myIndex } = input;
	const trump = rs.trumpColor ?? 'black';
	const myHand = getMyRookHand(params, myIndex);
	const isRoundComplete = params.moves.length >= getCardsPerPlayer(params) * params.playerCount;
	const currentTurnIndex = getTurnIndex({ rs, params, leaderIdx: computeLeader(params, trump) });
	const isMyTurn = !isRoundComplete && currentTurnIndex === myIndex;
	const trickPlays = getTrickPlays(params);
	const lastTrickWinnerId = resolveLastTrickWinner(params, trump);
	return {
		trump,
		myHand,
		isRoundComplete,
		currentTurnIndex,
		isMyTurn,
		trickPlays,
		lastTrickWinnerId
	};
}

interface PlayInput {
	readonly params: DeriveParams;
	readonly rs: RookRoundState;
	readonly myIndex: number;
}

function buildPlayResult(c: ReturnType<typeof computePlayCore>, input: PlayInput) {
	const playable = getPlayableCards({
		hand: c.myHand,
		isMyTurn: c.isMyTurn,
		trickPlays: c.trickPlays,
		trump: c.trump
	});
	const endState = resolveEndState({
		params: input.params,
		rs: input.rs,
		isRoundComplete: c.isRoundComplete,
		lastWinnerId: c.lastTrickWinnerId
	});
	return {
		playableCards: playable,
		allPlayerStats: computePlayerStats(input.params, c.trump),
		...endState,
		gameSpecific: buildRookUiState({ rs: input.rs, params: input.params, myIndex: input.myIndex })
	};
}

function derivePlayingState(input: PlayInput): DerivedState {
	const { params, rs, myIndex } = input;
	const c = computePlayCore({ params, rs, myIndex });
	return {
		handType: `Trump: ${rs.trumpColor}`,
		myRemainingHand: c.myHand.map(rookToCard),
		trickPlays: c.trickPlays,
		lastCompleteTrick: getLastTrick(params),
		lastTrickWinnerId: c.lastTrickWinnerId,
		currentTurnIndex: c.currentTurnIndex,
		isMyTurn: c.isMyTurn,
		isRoundComplete: c.isRoundComplete,
		...buildPlayResult(c, input)
	};
}

export function deriveRookState(params: DeriveParams): DerivedState {
	const rs = parseRookState({
		raw: params.gameSpecific,
		playerIds: params.playerIds,
		dealerIndex: params.dealerIndex
	});
	const myIndex = params.playerIds.indexOf(params.myId);
	const input = { params, rs, myIndex };
	if (rs.phase === 'playing') return derivePlayingState(input);
	return deriveBiddingState(input);
}
