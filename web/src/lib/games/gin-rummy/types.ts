import type { Card } from '$lib/platform/types/card';

export type MeldType = 'set' | 'run';

export interface Meld {
	readonly type: MeldType;
	readonly cards: readonly Card[];
}

export interface MeldPartition {
	readonly melds: readonly Meld[];
	readonly deadwood: readonly Card[];
	readonly deadwoodPoints: number;
}

export interface LayoffResult {
	readonly laidOffCards: readonly Card[];
	readonly remainingDeadwood: readonly Card[];
	readonly remainingDeadwoodPoints: number;
}

export interface GinRoundScoring {
	readonly knockerId: string;
	readonly defenderId: string;
	readonly winnerId: string;
	readonly pointsWon: number;
	readonly isGin: boolean;
	readonly isBigGin: boolean;
	readonly isUndercut: boolean;
	readonly knockerDeadwood: number;
	readonly defenderInitialDeadwood: number;
	readonly defenderDeadwoodAfterLayoffs: number;
	readonly layoffs: readonly Card[];
	readonly description: string;
}

export type GinPhase = 'draw' | 'discard' | 'roundEnd';

export interface GinUiState {
	readonly phase: GinPhase;
	readonly topDiscard: Card | null;
	readonly discardPile: readonly Card[];
	readonly stockCount: number;
	readonly turnPlayerId: string;
	readonly knockerId: string | null;
	readonly myMelds: readonly Meld[];
	readonly myDeadwood: readonly Card[];
	readonly myDeadwoodPoints: number;
	readonly canKnock: boolean;
	readonly isGin: boolean;
	readonly isBigGin: boolean;
	readonly scoringResult?: GinRoundScoring;
}

export const GIN_TARGET_SCORE = 100;
export const GIN_BONUS = 25;
export const BIG_GIN_BONUS = 31;
export const UNDERCUT_BONUS = 25;
