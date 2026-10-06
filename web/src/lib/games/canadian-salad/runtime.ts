import { setupHand } from './definition.ts';
import { HAND_SEQUENCE, HAND_LABELS, HAND_RULES } from './types.ts';
import { deriveCanadianSaladState } from './derive-state.ts';
import { computeCanadianSaladAiMove } from './ai.ts';
import type { GameRuntime, DeriveParams, DerivedState } from '$lib/platform/types/game-runtime';
import type { AiMoveParams, AiMoveResult, DealResult } from '$lib/platform/types/game-runtime';

const TOTAL_ROUNDS = HAND_SEQUENCE.length;

export const canadianSaladRuntime: GameRuntime = {
	id: 'canadian-salad',
	name: 'Canadian Salad',
	minPlayers: 3,
	maxPlayers: 6,
	totalRounds: TOTAL_ROUNDS,

	deal(playerCount: number, seed: number): DealResult {
		return setupHand(playerCount, seed);
	},

	deriveState(params: DeriveParams): DerivedState {
		return deriveCanadianSaladState(params);
	},

	computeAiMove(params: AiMoveParams): AiMoveResult | null {
		return computeCanadianSaladAiMove(params);
	},

	getRoundLabel(round: number): string {
		const handType = HAND_SEQUENCE[round];
		return handType ? HAND_LABELS[handType] : `Round ${round + 1}`;
	},

	getRoundRules(round: number): string {
		const handType = HAND_SEQUENCE[round];
		return handType ? HAND_RULES[handType] : '';
	}
};
