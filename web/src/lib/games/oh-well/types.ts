import type { Suit } from '$lib/platform/types/index';

export type OhWellPhase = 'bidding' | 'playing';

export interface PlayerBid {
	readonly playerId: string;
	readonly bid: number;
}

export interface OhWellRoundState {
	readonly phase: OhWellPhase;
	readonly trumpSuit: Suit | null;
	readonly bids: readonly PlayerBid[];
	readonly currentBidder: number;
	readonly cardsPerPlayer: number;
}

const MAX_CARDS_BY_PLAYERS: Record<number, number> = {
	3: 10,
	4: 10,
	5: 10,
	6: 8,
	7: 7
};

export function getMaxCards(playerCount: number): number {
	return MAX_CARDS_BY_PLAYERS[playerCount] ?? 7;
}

export function getCardsForRound(round: number, playerCount: number): number {
	const max = getMaxCards(playerCount);
	const totalRounds = max * 2 - 1;
	if (round < max) return max - round;
	if (round < totalRounds) return round - max + 2;
	return max;
}

export function getTotalRounds(playerCount: number): number {
	return getMaxCards(playerCount) * 2 - 1;
}

interface HookBidParams {
	readonly bid: number;
	readonly existingBids: readonly PlayerBid[];
	readonly cardsPerPlayer: number;
}

export function isHookBid(params: HookBidParams): boolean {
	const totalSoFar = params.existingBids.reduce((s, b) => s + b.bid, 0);
	return totalSoFar + params.bid === params.cardsPerPlayer;
}

export const EXACT_BID_BONUS = 10;
