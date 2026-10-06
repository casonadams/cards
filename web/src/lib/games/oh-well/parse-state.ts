import { getCardsForRound } from './types.ts';
import type { OhWellRoundState } from './types.ts';

export interface ParseParams {
	readonly raw: unknown;
	readonly currentRound: number;
	readonly playerCount: number;
}

function defaultState(params: ParseParams): OhWellRoundState {
	return {
		phase: 'bidding',
		trumpSuit: null,
		bids: [],
		currentBidder: 0,
		cardsPerPlayer: getCardsForRound(params.currentRound, params.playerCount)
	};
}

function parsePhase(obj: Record<string, unknown>): OhWellRoundState['phase'] {
	return (obj.phase as OhWellRoundState['phase']) ?? 'bidding';
}

function parseTrumpSuit(obj: Record<string, unknown>): OhWellRoundState['trumpSuit'] {
	return (obj.trumpSuit as OhWellRoundState['trumpSuit']) ?? null;
}

function parseBids(obj: Record<string, unknown>): OhWellRoundState['bids'] {
	return Array.isArray(obj.bids) ? obj.bids : [];
}

function parseCardsPerPlayer(obj: Record<string, unknown>, params: ParseParams): number {
	return (
		(obj.cardsPerPlayer as number) ?? getCardsForRound(params.currentRound, params.playerCount)
	);
}

function parseFromObject(obj: Record<string, unknown>, params: ParseParams): OhWellRoundState {
	return {
		phase: parsePhase(obj),
		trumpSuit: parseTrumpSuit(obj),
		bids: parseBids(obj),
		currentBidder: (obj.currentBidder as number) ?? 0,
		cardsPerPlayer: parseCardsPerPlayer(obj, params)
	};
}

export function parseOhWellState(params: ParseParams): OhWellRoundState {
	if (!params.raw || typeof params.raw !== 'object') return defaultState(params);
	return parseFromObject(params.raw as Record<string, unknown>, params);
}
