import { rookToCard } from './card-adapter.ts';
import { getTeamForPlayer } from './ui-state.ts';
import type { DeriveParams } from '$lib/platform/types/game-runtime';
import type { RookRoundState } from './types.ts';
import type { RookUiState } from './ui-state.ts';

interface BidderInfo {
	readonly bidderName: string;
	readonly biddingTeam: 1 | 2;
}

function getBidderInfo(rs: RookRoundState, params: DeriveParams): BidderInfo {
	const bidderIndex = rs.bidState.highBidder;
	if (bidderIndex < 0) return { bidderName: '', biddingTeam: 1 };
	return {
		bidderName: params.playerIds[bidderIndex] ?? '',
		biddingTeam: getTeamForPlayer(rs.partnerships, params.playerIds[bidderIndex])
	};
}

interface BidTurnInfo {
	readonly canBid: boolean;
	readonly canPass: boolean;
	readonly minNextBid: number;
}

function getBidTurnInfo(rs: RookRoundState, myIndex: number): BidTurnInfo {
	const isMyBidTurn = rs.phase === 'bidding' && rs.bidState.currentBidder === myIndex;
	const minNext = rs.bidState.highBid > 0 ? rs.bidState.highBid + 5 : 70;
	return { canBid: isMyBidTurn, canPass: isMyBidTurn, minNextBid: minNext };
}

export interface BuildUiInput {
	readonly rs: RookRoundState;
	readonly params: DeriveParams;
	readonly myIndex: number;
}

export function buildRookUiState(input: BuildUiInput): RookUiState {
	const { rs, params, myIndex } = input;
	const { bidderName, biddingTeam } = getBidderInfo(rs, params);
	const bidTurn = getBidTurnInfo(rs, myIndex);
	return {
		phase: rs.phase,
		trumpColor: rs.trumpColor,
		partnerships: rs.partnerships,
		highBid: rs.bidState.highBid,
		highBidderName: bidderName,
		biddingTeam,
		team1Score: rs.team1Total,
		team2Score: rs.team2Total,
		...bidTurn,
		nestCards: rs.nest.map(rookToCard),
		isHighBidder: rs.bidState.highBidder === myIndex
	};
}
