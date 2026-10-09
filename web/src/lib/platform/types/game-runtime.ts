import type { Card, Hand, Move, TrickPlay } from './card.ts';
import type { ScoreEntry } from './game.ts';
export interface DeriveParams {
	readonly moves: readonly Move[];
	readonly seed: number;
	readonly currentRound: number;
	readonly playerCount: number;
	readonly playerIds: readonly string[];
	readonly myId: string;
	readonly dealerIndex: number;
	readonly gameSpecific?: unknown;
}

export interface DealResult {
	readonly hands: readonly Hand[];
	readonly removedCards: readonly Card[];
}

export interface AiMoveParams {
	readonly moves: readonly Move[];
	readonly seed: number;
	readonly currentRound: number;
	readonly playerCount: number;
	readonly playerIds: readonly string[];
	readonly aiPlayerId: string;
	readonly dealerIndex: number;
	readonly gameSpecific?: unknown;
}

export interface PlayerStats {
	readonly playerId: string;
	readonly tricksTaken: number;
	readonly currentScore: number;
}

export interface DerivedState {
	readonly handType: string;
	readonly myRemainingHand: readonly Card[];
	readonly trickPlays: readonly TrickPlay[];
	readonly lastCompleteTrick: readonly TrickPlay[];
	readonly lastTrickWinnerId: string | null;
	readonly currentTurnIndex: number;
	readonly isMyTurn: boolean;
	readonly playableCards: readonly Card[];
	readonly isRoundComplete: boolean;
	readonly roundScores: readonly ScoreEntry[] | null;
	readonly isGameOver: boolean;
	readonly allPlayerStats: readonly PlayerStats[];
	readonly gameSpecific?: unknown;
}

export interface AiMoveResult {
	readonly playerId: string;
	readonly card: Card;
}

export interface GameRuntime {
	readonly id: string;
	readonly name: string;
	readonly minPlayers: number;
	readonly maxPlayers: number;
	readonly totalRounds: number;

	deal(playerCount: number, seed: number): DealResult;
	deriveState(params: DeriveParams): DerivedState;
	computeAiMove(params: AiMoveParams): AiMoveResult | null;
	getRoundLabel(round: number): string;
	getRoundRules(round: number): string;
}
