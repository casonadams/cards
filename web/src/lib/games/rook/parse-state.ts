import { createInitialBidState } from './bidding.ts';
import { createPartnerships } from './ui-state.ts';
import type { RookRoundState, BidState } from './types.ts';

function ensureArray<T>(val: unknown): readonly T[] {
	return Array.isArray(val) ? val : [];
}

function num(val: unknown, fallback: number): number {
	return (val as number) ?? fallback;
}

export interface ParseRookParams {
	readonly raw: unknown;
	readonly playerIds: readonly string[];
	readonly dealerIndex: number;
}

function createDefaultState(params: ParseRookParams): RookRoundState {
	return {
		phase: 'bidding',
		trumpColor: null,
		bidState: createInitialBidState((params.dealerIndex + 1) % params.playerIds.length),
		nest: [],
		partnerships: createPartnerships(params.playerIds),
		team1Total: 0,
		team2Total: 0,
		discardedNest: []
	};
}

function parseBidState(bidRaw: Record<string, unknown>): BidState {
	return {
		currentBidder: num(bidRaw.currentBidder, 0),
		highBid: num(bidRaw.highBid, 0),
		highBidder: num(bidRaw.highBidder, -1),
		passCount: num(bidRaw.passCount, 0),
		bids: ensureArray(bidRaw.bids)
	};
}

function parsePhase(obj: Record<string, unknown>): RookRoundState['phase'] {
	return (obj.phase as RookRoundState['phase']) ?? 'bidding';
}

function parseTrump(obj: Record<string, unknown>): RookRoundState['trumpColor'] {
	return (obj.trumpColor as RookRoundState['trumpColor']) ?? null;
}

function parsePartnerships(
	obj: Record<string, unknown>,
	playerIds: readonly string[]
): RookRoundState['partnerships'] {
	return (obj.partnerships as RookRoundState['partnerships']) ?? createPartnerships(playerIds);
}

function parseExistingState(
	obj: Record<string, unknown>,
	playerIds: readonly string[]
): RookRoundState {
	const bidRaw = (obj.bidState as Record<string, unknown>) ?? {};
	return {
		phase: parsePhase(obj),
		trumpColor: parseTrump(obj),
		bidState: parseBidState(bidRaw),
		nest: ensureArray(obj.nest),
		partnerships: parsePartnerships(obj, playerIds),
		team1Total: num(obj.team1Total, 0),
		team2Total: num(obj.team2Total, 0),
		discardedNest: ensureArray(obj.discardedNest)
	};
}

export function parseRookState(params: ParseRookParams): RookRoundState {
	if (!params.raw || typeof params.raw !== 'object') {
		return createDefaultState(params);
	}
	return parseExistingState(params.raw as Record<string, unknown>, params.playerIds);
}
