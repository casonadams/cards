import { dealOhWell } from './deal.ts';
import { isValidPlay } from './trick.ts';
import { resolveOhWellTrick } from './trick.ts';
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

function pickCard(hand: readonly Card[], trickPlays: TrickPlay[]): Card {
	const ledSuit = trickPlays.length > 0 ? trickPlays[0].card.suit : null;
	const valid = hand.filter((c) => isValidPlay({ card: c, hand, ledSuit }));
	return valid[Math.floor(Math.random() * valid.length)] ?? hand[0];
}

function isPlayingState(rs: OhWellRoundState | null): rs is OhWellRoundState {
	return rs !== null && rs.phase === 'playing';
}

function isNotMyTurn(params: AiMoveParams, trumpSuit: Suit | null): boolean {
	return getCurrentTurnId(params, trumpSuit) !== params.aiPlayerId;
}

function buildTrickPlays(params: AiMoveParams): TrickPlay[] {
	const trickStart = params.moves.length - (params.moves.length % params.playerCount);
	return params.moves.slice(trickStart).map((m) => ({ playerId: m.playerId, card: m.card }));
}

function canAct(params: AiMoveParams, rs: OhWellRoundState): boolean {
	return !isNotMyTurn(params, rs.trumpSuit);
}

function getPlayableHand(params: AiMoveParams, rs: OhWellRoundState): readonly Card[] | null {
	if (!canAct(params, rs)) return null;
	const hand = getAiHand({ params, cardsPerPlayer: rs.cardsPerPlayer });
	return hand.length > 0 ? hand : null;
}

export function computeOhWellAiMove(params: AiMoveParams): AiMoveResult | null {
	const rs = getState(params.gameSpecific);
	if (!isPlayingState(rs)) return null;
	const hand = getPlayableHand(params, rs);
	if (!hand) return null;
	return { playerId: params.aiPlayerId, card: pickCard(hand, buildTrickPlays(params)) };
}

export function computeAiBid(params: AiMoveParams): number {
	const rs = params.gameSpecific as OhWellRoundState;
	const hand = getAiHand({ params, cardsPerPlayer: rs.cardsPerPlayer });
	const trumpCount = rs.trumpSuit ? hand.filter((c) => c.suit === rs.trumpSuit).length : 0;
	const highCards = hand.filter((c) => c.rank >= 12).length;
	return Math.max(0, Math.round((trumpCount + highCards) / 2));
}
