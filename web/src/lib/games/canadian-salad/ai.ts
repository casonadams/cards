import { setupHand } from './definition.ts';
import { HAND_SEQUENCE } from './types.ts';
import {
	resolveTrick,
	trackPlayerVoids,
	validatePlay,
	computeTrickLeader,
	computeCurrentTurnIndex
} from '$lib/platform/engine/index';
import { simulateBestCanadianSaladCard } from './ai-simulation.ts';
import type { Hand } from '$lib/platform/types/index';
import type { Move, TrickPlay } from '$lib/platform/engine/index';
import type { AiMoveParams, AiMoveResult } from '$lib/platform/types/game-runtime';

function computeLeader(params: AiMoveParams): number {
	const { moves, playerCount, playerIds, dealerIndex } = params;
	return computeTrickLeader({ moves, playerCount, playerIds, dealerIndex, resolveWinner: resolveTrick });
}

function getCurrentTurnId(params: AiMoveParams): string {
	const leaderIdx = computeLeader(params);
	const turnIdx = computeCurrentTurnIndex(params.moves.length, params.playerCount, leaderIdx);
	return params.playerIds[turnIdx];
}

interface RemainingHandParams {
	readonly hand: Hand;
	readonly moves: readonly Move[];
	readonly aiId: string;
}

function getRemainingHand(params: RemainingHandParams): Hand {
	const played = params.moves.filter((m) => m.playerId === params.aiId).map((m) => m.card);
	return params.hand.filter((c) => !played.some((q) => q.suit === c.suit && q.rank === c.rank));
}

function getLedSuit(moves: readonly Move[], playerCount: number): string | null {
	const trickStart = moves.length - (moves.length % playerCount);
	const trickMoves = moves.slice(trickStart);
	return trickMoves.length > 0 ? trickMoves[0].card.suit : null;
}

export function computeCanadianSaladAiMove(params: AiMoveParams): AiMoveResult | null {
	if (getCurrentTurnId(params) !== params.aiPlayerId) return null;
	const aiIndex = params.playerIds.indexOf(params.aiPlayerId);
	const deal = setupHand(params.playerCount, params.seed + params.currentRound);
	const fullHand: Hand = Array.from(deal.hands[aiIndex] ?? []);
	const remaining = getRemainingHand({ hand: fullHand, moves: params.moves, aiId: params.aiPlayerId });
	if (remaining.length === 0) return null;

	const ledSuit = getLedSuit(params.moves, params.playerCount);
	const valid = remaining.filter((c) => validatePlay({ hand: remaining, card: c, ledSuit }).valid);
	const candidates = valid.length > 0 ? valid : remaining;

	const trickStart = params.moves.length - (params.moves.length % params.playerCount);
	const currentTrick: TrickPlay[] = params.moves
		.slice(trickStart)
		.map((m) => ({ playerId: m.playerId, card: m.card }));

	const handType = HAND_SEQUENCE[params.currentRound] ?? 'COMBINATION';
	const card = simulateBestCanadianSaladCard({
		candidates,
		aiHand: remaining,
		currentTrick,
		moves: params.moves,
		playerIds: params.playerIds,
		aiId: params.aiPlayerId,
		handType,
		allDealtCards: deal.hands.flat(),
		initialDealCounts: deal.hands.map((h) => h.length),
		voids: trackPlayerVoids(params.moves, params.playerCount, params.playerIds)
	});

	return { playerId: params.aiPlayerId, card };
}
