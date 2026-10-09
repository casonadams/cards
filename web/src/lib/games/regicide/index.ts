export { regicideRuntime } from './runtime.ts';
export { setupRegicide } from './setup.ts';
export { initGameState, createEnemy } from './engine.ts';
export { playCards } from './play-cards.ts';
export { yieldTurn } from './yield-turn.ts';
export { defendWithCards } from './defend-cards.ts';
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
