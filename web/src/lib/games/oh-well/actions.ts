import { dealOhWell } from './deal.ts';
import { getCardsForRound } from './types.ts';
import { parseOhWellState } from './parse-state.ts';
import type { GameDocument } from '$lib/platform/engine/index';
import type { OhWellRoundState, PlayerBid } from './types.ts';

export interface InitOhWellParams {
	readonly playerIds: readonly string[];
	readonly dealerIndex: number;
	readonly seed: number;
	readonly currentRound: number;
}

export function createInitialOhWellState(params: InitOhWellParams): OhWellRoundState {
	const { playerIds, dealerIndex, seed, currentRound } = params;
	const cardsPerPlayer = getCardsForRound(currentRound, playerIds.length);
	const deal = dealOhWell({
		playerCount: playerIds.length,
		cardsPerPlayer,
		seed: seed + currentRound
	});
	return {
		phase: 'bidding',
		trumpSuit: deal.trumpSuit,
		bids: [],
		currentBidder: (dealerIndex + 1) % playerIds.length,
		cardsPerPlayer
	};
}

interface BidParams {
	readonly doc: GameDocument;
	readonly playerId: string;
	readonly bid: number;
}

function buildBidResult(params: BidParams): GameDocument {
	const { doc, playerId, bid } = params;
	const rs = parseOhWellState({
		raw: doc.gameSpecific,
		currentRound: doc.currentRound,
		playerCount: doc.playerIds.length
	});
	const newBids: PlayerBid[] = [...rs.bids, { playerId, bid }];
	const allBidsIn = newBids.length === doc.playerIds.length;
	return {
		...doc,
		gameSpecific: {
			...rs,
			bids: newBids,
			currentBidder: allBidsIn ? -1 : (rs.currentBidder + 1) % doc.playerIds.length,
			phase: allBidsIn ? 'playing' : 'bidding'
		},
		lastUpdate: Date.now()
	};
}

export function applyOhWellBid(params: BidParams): GameDocument {
	return buildBidResult(params);
}
