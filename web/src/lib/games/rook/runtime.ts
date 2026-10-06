import { dealRook } from './deal.ts';
import { rookToCard } from './card-adapter.ts';
import { deriveRookState } from './derive-state.ts';
import { computeRookAiMove } from './ai.ts';
import { PLAYER_COUNT } from './types.ts';
import type { GameRuntime, DeriveParams, DerivedState } from '$lib/platform/types/game-runtime';
import type { AiMoveParams, AiMoveResult, DealResult } from '$lib/platform/types/game-runtime';

export const rookRuntime: GameRuntime = {
	id: 'rook',
	name: 'Rook',
	minPlayers: PLAYER_COUNT,
	maxPlayers: PLAYER_COUNT,
	totalRounds: 0,

	deal(playerCount: number, seed: number): DealResult {
		const result = dealRook(playerCount, seed);
		return {
			hands: result.hands.map((h) => h.map(rookToCard)),
			removedCards: []
		};
	},

	deriveState(params: DeriveParams): DerivedState {
		return deriveRookState(params);
	},

	computeAiMove(params: AiMoveParams): AiMoveResult | null {
		return computeRookAiMove(params);
	},

	getRoundLabel(round: number): string {
		return `Round ${round + 1}`;
	},

	getRoundRules(): string {
		return 'Follow suit if able. Trump beats led suit. Bird is highest trump.';
	}
};
