export type HeartsPhase = 'playing' | 'roundEnd';

export const HEARTS_POINTS_HEART = 1;
export const HEARTS_POINTS_QUEEN_OF_SPADES = 13;
export const HEARTS_TOTAL_PENALTY_POINTS = 26;
export const HEARTS_GAME_OVER_THRESHOLD = 100;

export interface HeartsRoundState {
	readonly phase: HeartsPhase;
	readonly heartsBroken: boolean;
	readonly tricksTaken: Record<string, number>;
	readonly pointsTaken: Record<string, number>;
	readonly cumulativeScores: Record<string, number>;
}
