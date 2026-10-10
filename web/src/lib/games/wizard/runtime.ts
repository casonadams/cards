import { dealWizard } from './deal.ts';
import { deriveWizardState } from './derive-state.ts';
import { computeWizardAiMove } from './ai.ts';
import type {
	GameRuntime,
	DeriveParams,
	DerivedState,
	AiMoveParams,
	AiMoveResult,
	DealResult
} from '$lib/platform/types/game-runtime';

export const wizardRuntime: GameRuntime = {
	id: 'wizard',
	name: 'Wizard',
	minPlayers: 3,
	maxPlayers: 6,
	totalRounds: 0,

	deal(playerCount: number, seed: number): DealResult {
		return dealWizard({ playerCount, currentRound: 0, seed });
	},

	deriveState(params: DeriveParams): DerivedState {
		return deriveWizardState(params);
	},

	computeAiMove(params: AiMoveParams): AiMoveResult | null {
		return computeWizardAiMove(params);
	},

	getRoundLabel(round: number): string {
		return `Round ${round + 1} (${round + 1} cards)`;
	},

	getRoundRules(round: number): string {
		return `Round ${round + 1}: Deal ${round + 1} cards each. Predict exact tricks. Wizards beat all cards (first Wizard wins ties); Jesters are lowest. Exact bid scores +20 + 10/trick; missed bid scores -10 per trick error.`;
	}
};

export default wizardRuntime;
