import { dealHearts } from './deal.ts';
import { deriveHeartsState } from './derive-state.ts';
import { computeHeartsAiMove } from './ai.ts';
import type {
	GameRuntime,
	DeriveParams,
	DerivedState,
	AiMoveParams,
	AiMoveResult,
	DealResult
} from '$lib/platform/types/game-runtime';

export const heartsRuntime: GameRuntime = {
	id: 'hearts',
	name: 'Hearts',
	minPlayers: 3,
	maxPlayers: 4,
	totalRounds: 0,

	deal(playerCount: number, seed: number): DealResult {
		return dealHearts(playerCount, seed);
	},

	deriveState(params: DeriveParams): DerivedState {
		return deriveHeartsState(params);
	},

	computeAiMove(params: AiMoveParams): AiMoveResult | null {
		return computeHeartsAiMove(params);
	},

	getRoundLabel(round: number): string {
		return `Round ${round + 1}`;
	},

	getRoundRules(): string {
		return 'Avoid taking Hearts (+1 pt each) and Queen of Spades (+13 pts). 2♣ must lead trick 1. Hearts cannot lead until broken. Shoot the Moon for -26 pts. Game ends at 100 pts; lowest score wins.';
	}
};

export default heartsRuntime;
