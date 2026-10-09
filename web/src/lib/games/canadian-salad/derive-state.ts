import { setupHand } from './definition.ts';
import { HAND_SEQUENCE } from './types.ts';
import {
	resolveTrick,
	extractCurrentTrickPlays,
	extractLastCompleteTrick,
	computeTrickLeader,
	computeCurrentTurnIndex
} from '$lib/platform/engine/index';
import { getPlayableCards } from './derive-playable.ts';
import { deriveScoring } from './derive-scoring.ts';
import type { DeriveParams, DerivedState } from '$lib/platform/types/game-runtime';
import type { Hand } from '$lib/platform/types/index';

function getMyHand(params: DeriveParams, myIndex: number) {
	const deal = setupHand(params.playerCount, params.seed + params.currentRound);
	const myHand: Hand = deal.hands[myIndex] ?? [];
	const played = params.moves.filter((m) => m.playerId === params.myId).map((m) => m.card);
	const remaining = myHand.filter(
		(c) => !played.some((x) => x.suit === c.suit && x.rank === c.rank)
	);
	return { myHand, remaining };
}

function deriveTurnInfo(params: DeriveParams) {
	const { moves, playerCount, playerIds, dealerIndex } = params;
	const leaderIdx = computeTrickLeader({ moves, playerCount, playerIds, dealerIndex, resolveWinner: resolveTrick });
	const currentTurnIndex = computeCurrentTurnIndex(moves.length, playerCount, leaderIdx);
	return { currentTurnIndex };
}

function deriveTrickInfo(params: DeriveParams) {
	const trickPlays = extractCurrentTrickPlays(params.moves, params.playerCount);
	const ledSuit = trickPlays.length > 0 ? trickPlays[0].card.suit : null;
	const lastCompleteTrick = extractLastCompleteTrick(params.moves, params.playerCount);
	const lastTrickWinnerId =
		lastCompleteTrick.length > 0 ? resolveTrick(lastCompleteTrick).winnerId : null;
	return { trickPlays, ledSuit, lastCompleteTrick, lastTrickWinnerId };
}

function computeCore(params: DeriveParams, myIndex: number) {
	const handType = HAND_SEQUENCE[params.currentRound];
	const { myHand, remaining } = getMyHand(params, myIndex);
	const isRoundComplete = params.moves.length >= myHand.length * params.playerCount;
	const { currentTurnIndex } = deriveTurnInfo(params);
	const isMyTurn = !isRoundComplete && currentTurnIndex === myIndex;
	const tricks = deriveTrickInfo(params);
	const playable = getPlayableCards({
		hand: remaining,
		isMyTurn,
		ledSuit: tricks.ledSuit,
		myIndex,
		playerCount: params.playerCount
	});
	const isGameOver = isRoundComplete && params.currentRound >= HAND_SEQUENCE.length - 1;
	const scoring = deriveScoring({ params, handType, isRoundComplete });
	return {
		handType,
		remaining,
		isRoundComplete,
		currentTurnIndex,
		isMyTurn,
		playable,
		isGameOver,
		tricks,
		scoring
	};
}

function buildDerivedResult(ctx: { params: DeriveParams; myIndex: number }): DerivedState {
	const c = computeCore(ctx.params, ctx.myIndex);
	return {
		handType: c.handType,
		myRemainingHand: c.remaining,
		trickPlays: c.tricks.trickPlays,
		lastCompleteTrick: c.tricks.lastCompleteTrick,
		lastTrickWinnerId: c.tricks.lastTrickWinnerId,
		currentTurnIndex: c.currentTurnIndex,
		isMyTurn: c.isMyTurn,
		playableCards: c.playable,
		isRoundComplete: c.isRoundComplete,
		allPlayerStats: c.scoring.allPlayerStats,
		roundScores: c.scoring.roundScores,
		isGameOver: c.isGameOver
	};
}

export function deriveCanadianSaladState(params: DeriveParams): DerivedState {
	const myIndex = params.playerIds.indexOf(params.myId);
	return buildDerivedResult({ params, myIndex });
}
