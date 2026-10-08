import { dealOhWell } from './deal.ts';
import { deriveOhWellState } from './derive-state.ts';
import { computeOhWellAiMove } from './ai.ts';
import type { GameRuntime, DeriveParams, DerivedState } from '$lib/platform/types/game-runtime';
import type { AiMoveParams, AiMoveResult, DealResult } from '$lib/platform/types/game-runtime';

export const ohWellRuntime: GameRuntime = {
	id: 'oh-well',
	name: 'Oh Well',
	minPlayers: 3,
	maxPlayers: 7,
	totalRounds: 0,

	deal(playerCount: number, seed: number): DealResult {
		const result = dealOhWell({ playerCount, cardsPerPlayer: 10, seed });
		return { hands: result.hands, removedCards: [] };
	},

	deriveState(params: DeriveParams): DerivedState {
		return deriveOhWellState(params);
	},

	computeAiMove(params: AiMoveParams): AiMoveResult | null {
		return computeOhWellAiMove(params);
	},

	getRoundLabel(round: number): string {
		return `Round ${round + 1}`;
	},

	getRoundRules(): string {
		return 'Predict exact tricks. Exact bid = +10 bonus + 1 pt per trick; missed bid = 0 pts. Must follow led suit if able; trump beats led suit.';
	}
};
