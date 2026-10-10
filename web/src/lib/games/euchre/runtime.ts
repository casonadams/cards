import { dealEuchre } from './deal.ts';
import { deriveEuchreState } from './derive-state.ts';
import { computeEuchreAiMove } from './ai.ts';
import type {
	GameRuntime,
	DeriveParams,
	DerivedState,
	AiMoveParams,
	AiMoveResult,
	DealResult
} from '$lib/platform/types/game-runtime';

export const euchreRuntime: GameRuntime = {
	id: 'euchre',
	name: 'Euchre',
	minPlayers: 4,
	maxPlayers: 4,
	totalRounds: 0,

	deal(_playerCount: number, seed: number): DealResult {
		return dealEuchre(seed);
	},

	deriveState(params: DeriveParams): DerivedState {
		return deriveEuchreState(params);
	},

	computeAiMove(params: AiMoveParams): AiMoveResult | null {
		return computeEuchreAiMove(params);
	},

	getRoundLabel(round: number): string {
		return `Round ${round + 1}`;
	},

	getRoundRules(): string {
		return '24-card deck (9..A). Right Bower (Jack of trump) is highest, Left Bower (same-color Jack) is 2nd highest trump. Two-round trump naming with stick-the-dealer. 3-4 tricks = 1 pt, march = 2 pts, lone march = 4 pts, euchre defenders = 2 pts. Play to 10.';
	}
};

export default euchreRuntime;
