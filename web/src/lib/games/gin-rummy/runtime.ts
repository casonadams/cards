import type {
	GameRuntime,
	DeriveParams,
	DerivedState,
	AiMoveParams,
	AiMoveResult,
	DealResult
} from '$lib/platform/types/game-runtime';
import { dealGinRummy } from './deal.ts';
import { deriveGinRummyState } from './derive-state.ts';
import { computeGinRummyAiMove } from './ai.ts';

export const ginRummyRuntime: GameRuntime = {
	id: 'gin-rummy',
	name: 'Gin Rummy',
	minPlayers: 2,
	maxPlayers: 2,
	totalRounds: 0,

	deal(playerCount: number, seed: number): DealResult {
		const result = dealGinRummy(seed, 0);
		return {
			hands: result.hands,
			removedCards: []
		};
	},

	deriveState(params: DeriveParams): DerivedState {
		return deriveGinRummyState(params);
	},

	computeAiMove(params: AiMoveParams): AiMoveResult | null {
		return computeGinRummyAiMove(params);
	},

	getRoundLabel(round: number): string {
		return `Hand ${round + 1}`;
	},

	getRoundRules(): string {
		return 'Draw and discard to form melds (sets of 3-4, runs of 3+). Deadwood <= 10 allows Knock. Gin = 0 deadwood (+25 bonus). Big Gin (+31 bonus). Layoffs permitted against non-Gin knocks. Undercut bonus (+25). Play to 100.';
	}
};
