import { ENEMY_STATS, type Enemy, type RegicidePhase } from './types.ts';
import type { Card } from '$lib/platform/types/index';

export interface GameState {
	readonly castle: readonly Card[];
	readonly hands: readonly (readonly Card[])[];
	readonly tavern: readonly Card[];
	readonly discard: readonly Card[];
	readonly currentEnemy: Enemy | null;
	readonly currentPlayer: number;
	readonly phase: RegicidePhase;
	readonly defenseNeeded: number;
	readonly defendingPlayer: number;
	readonly playerCount: number;
	readonly lastPlayedCards: readonly Card[];
	readonly lastSuitPowers: readonly string[];
}

export interface InitGameParams {
	readonly castle: readonly Card[];
	readonly hands: readonly (readonly Card[])[];
	readonly tavern: readonly Card[];
}

export function createEnemy(card: Card): Enemy {
	const stats = ENEMY_STATS[String(card.rank)];
	if (!stats) throw new Error(`Not a face card: ${card.rank}`);
	return {
		card,
		maxHealth: stats.health,
		baseAttack: stats.attack,
		currentHealth: stats.health,
		attackReduction: 0,
		immunityBroken: false
	};
}

export function initGameState(params: InitGameParams): GameState {
	const [first, ...rest] = params.castle;
	return {
		castle: rest,
		hands: params.hands,
		tavern: params.tavern,
		discard: [],
		currentEnemy: createEnemy(first),
		currentPlayer: 0,
		phase: 'play',
		defenseNeeded: 0,
		defendingPlayer: 0,
		playerCount: params.hands.length,
		lastPlayedCards: [],
		lastSuitPowers: []
	};
}

export function removeCardsFromHand(hand: readonly Card[], cards: readonly Card[]): Card[] {
	const remaining = [...hand];
	for (const c of cards) {
		const idx = remaining.findIndex((h) => h.suit === c.suit && h.rank === c.rank);
		if (idx >= 0) remaining.splice(idx, 1);
	}
	return remaining;
}

export { playCards } from './play-cards.ts';
export { yieldTurn } from './play-cards.ts';
export { defendWithCards } from './defend-cards.ts';

export function isGameLost(state: GameState): boolean {
	return state.phase === 'defeat';
}

export function isGameWon(state: GameState): boolean {
	return state.phase === 'victory';
}
