import type { Hand } from './card.ts';
import type { Player } from './player.ts';

export interface ScoreEntry {
	readonly playerId: string;
	readonly points: number;
}

export interface GameEvent {
	readonly type: string;
	readonly playerId: string;
	readonly timestamp: number;
	readonly payload: unknown;
}

export interface GameState<T = unknown> {
	readonly roundIndex: number;
	readonly scores: readonly ScoreEntry[];
	readonly hands: ReadonlyMap<string, Hand>;
	readonly custom: T;
}

export interface GameDefinition<T = unknown> {
	readonly id: string;
	readonly name: string;
	readonly minPlayers: number;
	readonly maxPlayers: number;

	setup(players: readonly Player[]): GameState<T>;
	validMoves(state: GameState<T>, playerId: string): readonly unknown[];
	applyMove(state: GameState<T>, playerId: string, move: unknown): GameState<T>;
	score(state: GameState<T>): readonly ScoreEntry[];
	isGameOver(state: GameState<T>): boolean;
}
