import type { Card } from '$lib/platform/types/card';

export type CribbagePhase = 'cribDiscard' | 'pegging' | 'show' | 'roundEnd';

export interface CribbageScoreBreakdown {
	readonly fifteens: number;
	readonly pairs: number;
	readonly runs: number;
	readonly flush: number;
	readonly nobs: number;
	readonly total: number;
	readonly descriptions: readonly string[];
}

export interface PeggingPlay {
	readonly playerId: string;
	readonly card: Card;
	readonly pointsScored: number;
	readonly descriptions: readonly string[];
	readonly runningTotal: number;
}

export interface CribbageUiState {
	readonly phase: CribbagePhase;
	readonly starterCard: Card | null;
	readonly hisHeels: boolean;
	readonly runningTotal: number;
	readonly currentCountCards: readonly Card[];
	readonly dealerId: string;
	readonly nonDealerId: string;
	readonly cribCount: number;
	readonly cribCards?: readonly Card[];
	readonly playerPegScores: Readonly<Record<string, number>>;
	readonly handBreakdowns?: Readonly<Record<string, CribbageScoreBreakdown>>;
	readonly cribBreakdown?: CribbageScoreBreakdown;
}

export const WINNING_SCORE = 121;
