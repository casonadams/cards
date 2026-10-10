export type SpadesGameMode = '4p_solo' | '4p_teams' | '5p_solo' | '6p_teams';
export type SpadesPhase = 'bidding' | 'playing' | 'roundEnd';
export type SpadesBidType = 'regular' | 'nil' | 'blind_nil';

export interface SpadesPlayerBid {
	readonly playerId: string;
	readonly bidType: SpadesBidType;
	readonly amount: number; // 0 for nil/blind_nil, 1..13 (or 1..17) for regular
}

export interface SpadesRoundState {
	readonly mode: SpadesGameMode;
	readonly phase: SpadesPhase;
	readonly bids: readonly SpadesPlayerBid[];
	readonly currentBidder: number;
	readonly spadesBroken: boolean;
	readonly tricksTaken: Record<string, number>;
	readonly bags: Record<string, number>; // teamId or playerId -> bags
	readonly cumulativeScores: Record<string, number>; // teamId or playerId -> score
}

export const SPADES_BAG_PENALTY_THRESHOLD = 10;
export const SPADES_BAG_PENALTY_POINTS = 100;
export const SPADES_NIL_BONUS = 100;
export const SPADES_BLIND_NIL_BONUS = 200;
export const SPADES_NIL_PENALTY = 50;
export const SPADES_BLIND_NIL_PENALTY = 100;
export const SPADES_TARGET_SCORE = 500;
