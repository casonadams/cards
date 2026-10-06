import type { RookColor, RookPhase, Partnership } from './types.ts';

export interface RookUiState {
	readonly phase: RookPhase;
	readonly trumpColor: RookColor | null;
	readonly partnerships: Partnership;
	readonly highBid: number;
	readonly highBidderName: string;
	readonly biddingTeam: 1 | 2;
	readonly team1Score: number;
	readonly team2Score: number;
	readonly canBid: boolean;
	readonly canPass: boolean;
	readonly minNextBid: number;
	readonly nestCards: readonly import('$lib/platform/types/index').Card[];
	readonly isHighBidder: boolean;
}

export function createPartnerships(playerIds: readonly string[]): Partnership {
	return {
		team1: [playerIds[0], playerIds[2]],
		team2: [playerIds[1], playerIds[3]]
	};
}

export function getTeamForPlayer(partnerships: Partnership, playerId: string): 1 | 2 {
	if (partnerships.team1.includes(playerId)) return 1;
	return 2;
}
