import { computeAiBid } from '$lib/games/oh-well/ai';
import { isHookBid } from '$lib/games/oh-well/types';
import { parseOhWellState } from '$lib/games/oh-well/parse-state';
import type { GameDocument } from '$lib/platform/engine/index';
import type { OhWellRoundState } from '$lib/games/oh-well/types';

function getDocState(doc: GameDocument): OhWellRoundState {
	return parseOhWellState({
		raw: doc.gameSpecific,
		currentRound: doc.currentRound,
		playerCount: doc.playerIds.length
	});
}

interface ClampBidParams {
	readonly bid: number;
	readonly rs: OhWellRoundState;
	readonly doc: GameDocument;
}

function isLastBidderHook(params: ClampBidParams): boolean {
	const isLastBidder = params.rs.bids.length === params.doc.playerIds.length - 1;
	if (!isLastBidder) return false;
	return isHookBid({
		bid: params.bid,
		existingBids: params.rs.bids,
		cardsPerPlayer: params.rs.cardsPerPlayer
	});
}

function adjustedBid(bid: number): number {
	return bid > 0 ? bid - 1 : bid + 1;
}

function clampBid(params: ClampBidParams): number {
	const raw = isLastBidderHook(params) ? adjustedBid(params.bid) : params.bid;
	return Math.min(raw, params.rs.cardsPerPlayer);
}

export function computeOhWellAiBid(doc: GameDocument): number {
	const rs = getDocState(doc);
	const aiId = doc.playerIds[rs.currentBidder];
	if (!aiId) return 0;
	const bid = computeAiBid({
		moves: doc.moves,
		seed: doc.seed,
		currentRound: doc.currentRound,
		playerCount: doc.playerIds.length,
		playerIds: doc.playerIds,
		aiPlayerId: aiId,
		dealerIndex: doc.dealerIndex,
		gameSpecific: doc.gameSpecific
	});
	return clampBid({ bid, rs, doc });
}
