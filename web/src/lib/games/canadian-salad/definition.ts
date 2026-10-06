import type { GameDefinition, GameState, ScoreEntry, Player } from '$lib/platform/types/index';
import { createDeck, dealWithSeed } from '$lib/platform/engine/index';
import { HAND_SEQUENCE, PLAYER_COUNT_CONFIGS } from './types.ts';

export interface CanadianSaladState {
	readonly handIndex: number;
	readonly seed: number;
	readonly playerIds: readonly string[];
}

export const canadianSaladDefinition: GameDefinition<CanadianSaladState> = {
	id: 'canadian-salad',
	name: 'Canadian Salad',
	minPlayers: 3,
	maxPlayers: 6,

	setup(players: readonly Player[]): GameState<CanadianSaladState> {
		const seed = Math.floor(Math.random() * 2147483647);
		return {
			roundIndex: 0,
			scores: [],
			hands: new Map(),
			custom: { handIndex: 0, seed, playerIds: players.map((p) => p.id) }
		};
	},

	validMoves(): readonly unknown[] {
		return [];
	},

	applyMove(state: GameState<CanadianSaladState>): GameState<CanadianSaladState> {
		return state;
	},

	score(): readonly ScoreEntry[] {
		return [];
	},

	isGameOver(state: GameState<CanadianSaladState>): boolean {
		return state.custom.handIndex >= HAND_SEQUENCE.length;
	}
};

export function setupHand(playerCount: number, seed: number) {
	const config = PLAYER_COUNT_CONFIGS[playerCount];
	if (!config) throw new Error(`Unsupported player count: ${playerCount}. Expected 3-6`);

	return dealWithSeed({
		deck: createDeck(),
		playerCount,
		seed,
		cardsToRemove: config.cardsToRemove
	});
}
