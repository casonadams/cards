import { dealRook } from './deal.ts';
import { applyBidAction, isBiddingComplete, createInitialBidState } from './bidding.ts';
import { createPartnerships } from './ui-state.ts';
import { parseRookState } from './parse-state.ts';
import type { GameDocument } from '$lib/platform/engine/index';
import type { RookRoundState, RookColor, BidAction, RookCard } from './types.ts';

export interface CreateRookStateParams {
	readonly playerIds: readonly string[];
	readonly dealerIndex: number;
	readonly seed: number;
	readonly currentRound: number;
}

export function createInitialRookState(params: CreateRookStateParams): RookRoundState {
	const deal = dealRook(params.playerIds.length, params.seed + params.currentRound);
	return {
		phase: 'bidding',
		trumpColor: null,
		bidState: createInitialBidState((params.dealerIndex + 1) % params.playerIds.length),
		nest: deal.nest,
		partnerships: createPartnerships(params.playerIds),
		team1Total: 0,
		team2Total: 0,
		discardedNest: []
	};
}

function getState(doc: GameDocument): RookRoundState {
	return parseRookState({
		raw: doc.gameSpecific,
		playerIds: doc.playerIds,
		dealerIndex: doc.dealerIndex
	});
}

export interface ApplyBidParams {
	readonly doc: GameDocument;
	readonly playerId: string;
	readonly action: BidAction;
	readonly amount: number | undefined;
}

export function applyBid(params: ApplyBidParams): GameDocument {
	const rs = getState(params.doc);
	const newBidState = applyBidAction({
		state: rs.bidState,
		playerId: params.playerId,
		action: params.action,
		amount: params.amount,
		playerCount: params.doc.playerIds.length
	});
	const biddingDone = isBiddingComplete(newBidState);
	return {
		...params.doc,
		gameSpecific: {
			...rs,
			bidState: newBidState,
			phase: biddingDone ? 'nestExchange' : 'bidding'
		},
		lastUpdate: Date.now()
	};
}

export interface NestExchangeParams {
	readonly doc: GameDocument;
	readonly discardedCards: readonly RookCard[];
	readonly trumpColor: RookColor;
}

export function applyNestExchange(params: NestExchangeParams): GameDocument {
	const rs = getState(params.doc);
	return {
		...params.doc,
		gameSpecific: {
			...rs,
			phase: 'playing',
			trumpColor: params.trumpColor,
			discardedNest: params.discardedCards,
			nest: []
		},
		lastUpdate: Date.now()
	};
}
