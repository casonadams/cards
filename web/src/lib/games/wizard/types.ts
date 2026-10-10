import type { Card, Rank, Suit } from '$lib/platform/types/card';

export const WIZARD_RANK = 15 as unknown as Rank;
export const JESTER_RANK = 1 as unknown as Rank;

export function isWizard(card: Card): boolean {
	return (card.rank as unknown as number) === 15;
}

export function isJester(card: Card): boolean {
	return (card.rank as unknown as number) === 1;
}

export function isStandardCard(card: Card): boolean {
	const r = card.rank as unknown as number;
	return r >= 2 && r <= 14;
}

export type WizardPhase = 'bidding' | 'playing' | 'roundEnd';

export interface WizardPlayerBid {
	readonly playerId: string;
	readonly bid: number;
}

export interface WizardRoundState {
	readonly phase: WizardPhase;
	readonly trumpCard: Card | null;
	readonly trumpSuit: Suit | null;
	readonly bids: readonly WizardPlayerBid[];
	readonly tricksTaken: Record<string, number>;
	readonly cumulativeScores: Record<string, number>;
}

export function getTotalWizardRounds(playerCount: number): number {
	return Math.floor(60 / playerCount);
}
