import { setupHand } from './definition.ts';
import { resolveTrick, pickAiCard } from '$lib/platform/engine/index';
import type { Hand } from '$lib/platform/types/index';
import type { Move, TrickPlay } from '$lib/platform/engine/index';
import type { AiMoveParams, AiMoveResult } from '$lib/platform/types/game-runtime';

function computeLeader(params: AiMoveParams): number {
	const { moves, playerCount, playerIds, dealerIndex } = params;
	if (moves.length === 0) return (dealerIndex + 1) % playerCount;
	const lastEnd = moves.length - (moves.length % playerCount);
	if (lastEnd === 0) return (dealerIndex + 1) % playerCount;
	const lastTrick = moves.slice(lastEnd - playerCount, lastEnd);
	const plays: TrickPlay[] = lastTrick.map((m) => ({ playerId: m.playerId, card: m.card }));
	return playerIds.indexOf(resolveTrick(plays).winnerId);
}

function getCurrentTurnId(params: AiMoveParams): string {
	const leaderIdx = computeLeader(params);
	const playsInTrick = params.moves.length % params.playerCount;
	const turnIdx = (leaderIdx + playsInTrick) % params.playerCount;
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

function getAiRemainingCards(params: AiMoveParams): Hand {
	const aiIndex = params.playerIds.indexOf(params.aiPlayerId);
	const deal = setupHand(params.playerCount, params.seed + params.currentRound);
	const fullHand: Hand = Array.from(deal.hands[aiIndex] ?? []);
	return getRemainingHand({ hand: fullHand, moves: params.moves, aiId: params.aiPlayerId });
}

export function computeCanadianSaladAiMove(params: AiMoveParams): AiMoveResult | null {
	if (getCurrentTurnId(params) !== params.aiPlayerId) return null;
	const remaining = getAiRemainingCards(params);
	if (remaining.length === 0) return null;
	const ledSuit = getLedSuit(params.moves, params.playerCount);
	return { playerId: params.aiPlayerId, card: pickAiCard(remaining, ledSuit) };
}
