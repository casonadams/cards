import { setupRegicide } from './setup.ts';
import { deriveRegicideState } from './derive-state.ts';
import type { GameRuntime, DeriveParams, DerivedState } from '$lib/platform/types/game-runtime';
import type { AiMoveResult, DealResult } from '$lib/platform/types/game-runtime';

export const regicideRuntime: GameRuntime = {
	id: 'regicide',
	name: 'Regicide',
	minPlayers: 2,
	maxPlayers: 4,
	totalRounds: 1,

	deal(playerCount: number, seed: number): DealResult {
		const setup = setupRegicide(playerCount, seed);
		return { hands: setup.hands, removedCards: [] };
	},

	deriveState(params: DeriveParams): DerivedState {
		return deriveRegicideState(params);
	},

	computeAiMove(): AiMoveResult | null {
		return null;
	},

	getRoundLabel(): string {
		return 'Regicide';
	},

	getRoundRules(): string {
		return 'Play cards to defeat enemies. Clubs double damage. Spades reduce attack. Hearts recycle. Diamonds draw.';
	}
};
