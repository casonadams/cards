import { dealRook, removeCards } from './deal.ts';
import { cardToRook, rookToCard } from './card-adapter.ts';
import { resolveRookTrick, isValidPlay } from './trick.ts';
import type { AiMoveParams, AiMoveResult } from '$lib/platform/types/game-runtime';
import type { RookCard, RookColor, RookRoundState } from './types.ts';
import { type TrickPlay, computeTrickLeader, computeCurrentTurnIndex } from '$lib/platform/engine/index';

function getTrump(gameSpecific: unknown): RookColor {
	if (!gameSpecific) return 'black';
	return (gameSpecific as RookRoundState).trumpColor ?? 'black';
}

function computeLeader(params: AiMoveParams, trump: RookColor): number {
	const { moves, playerCount, playerIds, dealerIndex } = params;
	return computeTrickLeader({
		moves,
		playerCount,
		playerIds,
		dealerIndex,
		resolveWinner: (plays) => {
			const rookPlays = plays.map((m) => ({ playerId: m.playerId, card: cardToRook(m.card) }));
			return resolveRookTrick(rookPlays, trump);
		}
	});
}

function getCurrentTurnId(params: AiMoveParams, trump: RookColor): string {
	const leaderIdx = computeLeader(params, trump);
	const turnIdx = computeCurrentTurnIndex(params.moves.length, params.playerCount, leaderIdx);
	return params.playerIds[turnIdx];
}

function getAiHand(params: AiMoveParams): readonly RookCard[] {
	const aiIndex = params.playerIds.indexOf(params.aiPlayerId);
	const deal = dealRook(params.playerCount, params.seed + params.currentRound);
	const fullHand = deal.hands[aiIndex] ?? [];
	const played = params.moves
		.filter((m) => m.playerId === params.aiPlayerId)
		.map((m) => cardToRook(m.card));
	return removeCards(fullHand, played);
}

function getLedColor(trickPlays: TrickPlay[], trump: RookColor): RookColor | null {
	if (trickPlays.length === 0) return null;
	const c = cardToRook(trickPlays[0].card);
	return c.type === 'bird' ? trump : c.color;
}

interface PickCardParams {
	readonly hand: readonly RookCard[];
	readonly trickPlays: TrickPlay[];
	readonly trump: RookColor;
}

function pickCard(params: PickCardParams): RookCard {
	const ledColor = getLedColor(params.trickPlays, params.trump);
	const valid = params.hand.filter((c) => isValidPlay({ card: c, hand: params.hand, ledColor }));
	return valid[Math.floor(Math.random() * valid.length)] ?? params.hand[0];
}

export function computeRookAiMove(params: AiMoveParams): AiMoveResult | null {
	const trump = getTrump(params.gameSpecific);
	if (getCurrentTurnId(params, trump) !== params.aiPlayerId) return null;
	const hand = getAiHand(params);
	if (hand.length === 0) return null;
	const trickStart = params.moves.length - (params.moves.length % params.playerCount);
	const trickPlays: TrickPlay[] = params.moves
		.slice(trickStart)
		.map((m) => ({ playerId: m.playerId, card: m.card }));
	const chosen = pickCard({ hand, trickPlays, trump });
	return { playerId: params.aiPlayerId, card: rookToCard(chosen) };
}
