import { dealSpades } from './deal.ts';
import { deriveSpadesState } from './derive-state.ts';
import { computeSpadesAiMove } from './ai.ts';
import type {
	GameRuntime,
	DeriveParams,
	DerivedState,
	AiMoveParams,
	AiMoveResult,
	DealResult
} from '$lib/platform/types/game-runtime';

export const spadesRuntime: GameRuntime = {
	id: 'spades',
	name: 'Spades',
	minPlayers: 4,
	maxPlayers: 6,
	totalRounds: 0,

	deal(playerCount: number, seed: number): DealResult {
		return dealSpades(playerCount, seed);
	},

	deriveState(params: DeriveParams): DerivedState {
		return deriveSpadesState(params);
	},

	computeAiMove(params: AiMoveParams): AiMoveResult | null {
		return computeSpadesAiMove(params);
	},

	getRoundLabel(round: number): string {
		return `Round ${round + 1}`;
	},

	getRoundRules(): string {
		return 'Spades are permanent trump and cannot lead until broken. Bid tricks to make contract. Nil scores +100/-100; Blind Nil scores +200/-200. Overtricks are bags; 10 bags penalty = -100 pts. In 6p mode, 2nd duplicate card played wins identical ties.';
	}
};

export default spadesRuntime;
