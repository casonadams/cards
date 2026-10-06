import type { Card } from '$lib/platform/types/index';
import type { Enemy, RegicidePhase } from './types.ts';

export interface RegicideUiState {
	readonly phase: RegicidePhase;
	readonly currentEnemy: Enemy | null;
	readonly castleRemaining: number;
	readonly tavernSize: number;
	readonly discardSize: number;
	readonly defenseNeeded: number;
	readonly isDefending: boolean;
	readonly canPlay: boolean;
	readonly canYield: boolean;
	readonly lastPlayedCards: readonly Card[];
	readonly lastSuitPowers: readonly string[];
	readonly enemyEffectiveAttack: number;
}
