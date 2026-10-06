export { regicideRuntime } from './runtime.ts';
export { setupRegicide } from './setup.ts';
export { initGameState, playCards, yieldTurn, defendWithCards, createEnemy } from './engine.ts';
export { computeRegicideAiAction } from './ai.ts';
export {
	cardAttackValue,
	isValidCombo,
	comboAttackValue,
	comboSuits,
	isEnemyImmune,
	ENEMY_STATS,
	HAND_SIZES,
	SUIT_POWER_NAMES
} from './types.ts';

export type { GameState } from './engine.ts';
export type { Enemy, RegicidePhase, RegicideState } from './types.ts';
export type { RegicideUiState } from './ui-state.ts';
