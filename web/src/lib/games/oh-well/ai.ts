import { dealOhWell } from './deal.ts';
import { isValidPlay, resolveOhWellTrick } from './trick.ts';
import { countTricksTaken } from './trick-counting.ts';
import { trackPlayerVoids } from '$lib/platform/engine/index';
import { simulateBestOhWellCard } from './ai-simulation.ts';
import type { AiMoveParams, AiMoveResult } from '$lib/platform/types/game-runtime';
import type { Card, Suit } from '$lib/platform/types/index';
import type { TrickPlay } from '$lib/platform/engine/index';
import type { OhWellRoundState } from './types.ts';

function getState(gameSpecific: unknown): OhWellRoundState | null {
	if (!gameSpecific) return null;
	return gameSpecific as OhWellRoundState;
}

function computeLeader(params: AiMoveParams, trumpSuit: Suit | null): number {
	const { moves, playerCount, playerIds, dealerIndex } = params;
	if (moves.length === 0) return (dealerIndex + 1) % playerCount;
	const lastEnd = moves.length - (moves.length % playerCount);
	if (lastEnd === 0) return (dealerIndex + 1) % playerCount;
	const lastTrick = moves.slice(lastEnd - playerCount, lastEnd);
	const plays: TrickPlay[] = lastTrick.map((m) => ({ playerId: m.playerId, card: m.card }));
	return playerIds.indexOf(resolveOhWellTrick(plays, trumpSuit).winnerId);
}

function getCurrentTurnId(params: AiMoveParams, trumpSuit: Suit | null): string {
	const leaderIdx = computeLeader(params, trumpSuit);
	const playsInTrick = params.moves.length % params.playerCount;
	const turnIdx = (leaderIdx + playsInTrick) % params.playerCount;
	return params.playerIds[turnIdx];
}

interface DealLookup {
	readonly params: AiMoveParams;
	readonly cardsPerPlayer: number;
}

function getAiHand(lookup: DealLookup): readonly Card[] {
	const { params, cardsPerPlayer } = lookup;
	const aiIndex = params.playerIds.indexOf(params.aiPlayerId);
	const deal = dealOhWell({
		playerCount: params.playerCount,
		cardsPerPlayer,
		seed: params.seed + params.currentRound
	});
	const fullHand = deal.hands[aiIndex] ?? [];
	const played = params.moves.filter((m) => m.playerId === params.aiPlayerId).map((m) => m.card);
	return fullHand.filter((c) => !played.some((p) => p.suit === c.suit && p.rank === c.rank));
}

function buildTrickPlays(params: AiMoveParams): TrickPlay[] {
	const trickStart = params.moves.length - (params.moves.length % params.playerCount);
	return params.moves.slice(trickStart).map((m) => ({ playerId: m.playerId, card: m.card }));
}

function getPlayableHand(params: AiMoveParams, rs: OhWellRoundState): readonly Card[] | null {
	if (getCurrentTurnId(params, rs.trumpSuit) !== params.aiPlayerId) return null;
	const hand = getAiHand({ params, cardsPerPlayer: rs.cardsPerPlayer });
	return hand.length > 0 ? hand : null;
}

export function computeOhWellAiMove(params: AiMoveParams): AiMoveResult | null {
	const rs = getState(params.gameSpecific);
	if (!rs || rs.phase !== 'playing') return null;
	const hand = getPlayableHand(params, rs);
	if (!hand) return null;

	const trickPlays = buildTrickPlays(params);
	const ledSuit = trickPlays.length > 0 ? (trickPlays[0].card.suit as Suit) : null;
	const valid = hand.filter((c) => isValidPlay({ card: c, hand, ledSuit }));
	const candidates = valid.length > 0 ? valid : hand;

	const deal = dealOhWell({
		playerCount: params.playerCount,
		cardsPerPlayer: rs.cardsPerPlayer,
		seed: params.seed + params.currentRound
	});

	const bids = new Map<string, number>();
	for (const b of rs.bids) bids.set(b.playerId, b.bid);

	const takenCounts = countTricksTaken(
		{
			moves: params.moves,
			seed: params.seed,
			currentRound: params.currentRound,
			playerCount: params.playerCount,
			playerIds: params.playerIds,
			myId: params.aiPlayerId,
			dealerIndex: params.dealerIndex,
			gameSpecific: params.gameSpecific
		},
		rs.trumpSuit
	);

	const card = simulateBestOhWellCard({
		candidates,
		aiHand: hand,
		currentTrick: trickPlays,
		moves: params.moves,
		playerIds: params.playerIds,
		aiId: params.aiPlayerId,
		trumpSuit: rs.trumpSuit,
		bids,
		takenCounts,
		cardsPerPlayer: rs.cardsPerPlayer,
		allDealtCards: deal.hands.flat(),
		voids: trackPlayerVoids(params.moves, params.playerCount, params.playerIds)
	});

	return { playerId: params.aiPlayerId, card };
}

export function computeAiBid(params: AiMoveParams): number {
	const rs = params.gameSpecific as OhWellRoundState;
	const hand = getAiHand({ params, cardsPerPlayer: rs.cardsPerPlayer });
	const trumpCount = rs.trumpSuit ? hand.filter((c) => c.suit === rs.trumpSuit).length : 0;
	const highCards = hand.filter((c) => c.rank >= 12).length;
	return Math.max(0, Math.round((trumpCount + highCards) / 2));
}
