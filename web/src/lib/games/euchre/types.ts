import type { Card, Suit } from '$lib/platform/types/card';

export type EuchrePhase =
	| 'naming_round1'
	| 'naming_round2'
	| 'dealer_discard'
	| 'playing'
	| 'roundEnd';

export interface EuchreNamingAction {
	readonly playerId: string;
	readonly action: 'pass' | 'order_up' | 'pick_up' | 'call_suit';
	readonly calledSuit?: Suit;
	readonly goAlone?: boolean;
}

export interface EuchreRoundState {
	readonly phase: EuchrePhase;
	readonly trumpSuit: Suit | null;
	readonly upcard: Card;
	readonly makerId: string | null;
	readonly makerTeam: 'team1' | 'team2' | null;
	readonly goingAlone: boolean;
	readonly alonePlayerId: string | null;
	readonly partnerSittingOutId: string | null;
	readonly currentCallerIndex: number;
	readonly tricksTaken: Record<string, number>;
	readonly teamTricks: { team1: number; team2: number };
	readonly cumulativeScores: { team1: number; team2: number };
}

export const EUCHRE_TARGET_SCORE = 10;
