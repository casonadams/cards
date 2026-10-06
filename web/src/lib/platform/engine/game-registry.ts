import type { GameRuntime } from '../types/game-runtime.ts';

export interface GameSummary {
	readonly id: string;
	readonly name: string;
	readonly minPlayers: number;
	readonly maxPlayers: number;
}

const registry = new Map<string, GameRuntime>();

export function registerGame(runtime: GameRuntime): void {
	registry.set(runtime.id, runtime);
}

export function getGame(id: string): GameRuntime {
	const game = registry.get(id);
	if (!game) throw new Error(`Game not found: ${id}`);
	return game;
}

export function listGames(): readonly GameSummary[] {
	return [...registry.values()].map((r) => ({
		id: r.id,
		name: r.name,
		minPlayers: r.minPlayers,
		maxPlayers: r.maxPlayers
	}));
}
