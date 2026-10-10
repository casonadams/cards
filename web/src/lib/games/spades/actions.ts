import type { GameDocument } from '$lib/platform/engine/index';
import type { SpadesRoundState, SpadesPlayerBid, SpadesGameMode } from './types.ts';

export interface InitSpadesParams {
	readonly playerIds: readonly string[];
	readonly dealerIndex?: number;
	readonly cumulativeScores?: Record<string, number>;
	readonly bags?: Record<string, number>;
}

export function createInitialSpadesState(params: InitSpadesParams): SpadesRoundState {
	const { playerIds, dealerIndex = 0, cumulativeScores = {}, bags = {} } = params;
	const mode: SpadesGameMode = playerIds.length === 6 ? '6p_teams' : '4p_teams';
	return {
		mode,
		phase: 'bidding',
		bids: [],
		currentBidder: (dealerIndex + 1) % playerIds.length,
		spadesBroken: false,
		tricksTaken: {},
		bags,
		cumulativeScores
	};
}

export interface ApplySpadesBidParams {
	readonly doc: GameDocument;
	readonly bid: SpadesPlayerBid;
}

export function applySpadesBid(params: ApplySpadesBidParams): GameDocument {
	const { doc, bid } = params;
	const existingRs = doc.gameSpecific as SpadesRoundState | undefined;
	const rs: SpadesRoundState =
		existingRs ??
		createInitialSpadesState({
			playerIds: doc.playerIds,
			dealerIndex: doc.dealerIndex
		});

	const existingIndex = rs.bids.findIndex((b) => b.playerId === bid.playerId);
	const newBids =
		existingIndex >= 0
			? rs.bids.map((b, i) => (i === existingIndex ? bid : b))
			: [...rs.bids, bid];

	const allBidsIn = newBids.length === doc.playerIds.length;
	const nextBidder = allBidsIn ? -1 : (rs.currentBidder + 1) % doc.playerIds.length;

	return {
		...doc,
		gameSpecific: {
			...rs,
			bids: newBids,
			currentBidder: nextBidder,
			phase: allBidsIn ? 'playing' : 'bidding'
		},
		lastUpdate: Date.now()
	};
}
