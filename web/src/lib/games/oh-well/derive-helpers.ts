import { dealOhWell } from './deal.ts';
import { resolveOhWellTrick, isValidPlay } from './trick.ts';
import { parseOhWellState } from './parse-state.ts';
import type { DeriveParams } from '$lib/platform/types/game-runtime';
import type { Card, Suit } from '$lib/platform/types/index';
import type { TrickPlay } from '$lib/platform/engine/index';
import type { OhWellRoundState } from './types.ts';

export function getState(params: DeriveParams): OhWellRoundState {
	return parseOhWellState({
		raw: params.gameSpecific,
		currentRound: params.currentRound,
		playerCount: params.playerCount
	});
}

export interface HandParams {
	readonly params: DeriveParams;
	readonly myIndex: number;
	readonly cardsPerPlayer: number;
}

export function getMyHand(hp: HandParams): readonly Card[] {
	const deal = dealOhWell({
		playerCount: hp.params.playerCount,
		cardsPerPlayer: hp.cardsPerPlayer,
		seed: hp.params.seed + hp.params.currentRound
	});
	const fullHand = deal.hands[hp.myIndex] ?? [];
	const played = hp.params.moves.filter((m) => m.playerId === hp.params.myId).map((m) => m.card);
	return fullHand.filter((c) => !played.some((p) => p.suit === c.suit && p.rank === c.rank));
}

export function computeLeader(params: DeriveParams, trumpSuit: Suit | null): number {
	const { moves, playerCount, playerIds, dealerIndex } = params;
	if (moves.length === 0) return (dealerIndex + 1) % playerCount;
	const lastEnd = moves.length - (moves.length % playerCount);
	if (lastEnd === 0) return (dealerIndex + 1) % playerCount;
	const lastTrick = moves.slice(lastEnd - playerCount, lastEnd);
	const plays: TrickPlay[] = lastTrick.map((m) => ({ playerId: m.playerId, card: m.card }));
	return playerIds.indexOf(resolveOhWellTrick(plays, trumpSuit).winnerId);
}

export function getTrickPlays(params: DeriveParams): TrickPlay[] {
	const start = params.moves.length - (params.moves.length % params.playerCount);
	return params.moves.slice(start).map((m) => ({ playerId: m.playerId, card: m.card }));
}

export function getLastTrick(params: DeriveParams): TrickPlay[] {
	const { moves, playerCount } = params;
	const start = moves.length - (moves.length % playerCount);
	if (start < playerCount) return [];
	return moves
		.slice(start - playerCount, start)
		.map((m) => ({ playerId: m.playerId, card: m.card }));
}

export interface PlayableParams {
	readonly hand: readonly Card[];
	readonly isMyTurn: boolean;
	readonly trickPlays: TrickPlay[];
}

function getLedSuit(trickPlays: TrickPlay[]): Suit | null {
	return trickPlays.length > 0 ? trickPlays[0].card.suit : null;
}

export function getPlayableCards(pp: PlayableParams): readonly Card[] {
	if (!pp.isMyTurn) return [];
	const ledSuit = getLedSuit(pp.trickPlays);
	return pp.hand.filter((c) => isValidPlay({ card: c, hand: pp.hand, ledSuit }));
}

export function computeHookBid(rs: OhWellRoundState): number | null {
	const totalSoFar = rs.bids.reduce((s, b) => s + b.bid, 0);
	const hook = rs.cardsPerPlayer - totalSoFar;
	return hook >= 0 && hook <= rs.cardsPerPlayer ? hook : null;
}
