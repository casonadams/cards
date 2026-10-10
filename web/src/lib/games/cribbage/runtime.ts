import type {
	GameRuntime,
	DeriveParams,
	DerivedState,
	AiMoveParams,
	AiMoveResult,
	DealResult
} from '$lib/platform/types/game-runtime';
import { dealCribbage } from './deal.ts';
import { deriveCribbageState } from './derive-state.ts';
import { computeCribbageAiMove } from './ai.ts';

export const cribbageRuntime: GameRuntime = {
	id: 'cribbage',
	name: 'Cribbage',
	minPlayers: 2,
	maxPlayers: 2,
	totalRounds: 0,

	deal(playerCount: number, seed: number): DealResult {
		const result = dealCribbage(seed, 0);
		return {
			hands: result.hands,
			removedCards: []
		};
	},

	deriveState(params: DeriveParams): DerivedState {
		return deriveCribbageState(params);
	},

	computeAiMove(params: AiMoveParams): AiMoveResult | null {
		return computeCribbageAiMove(params);
	},

	getRoundLabel(round: number): string {
		return `Hand ${round + 1}`;
	},

	getRoundRules(): string {
		return '6-card deal to 4-card hands + 2-card crib. Peg to 31 (15s, 31, pairs, runs, Go). Show scoring: 15s, pairs, runs, flushes, His Nobs. First to 121 wins.';
	}
};
