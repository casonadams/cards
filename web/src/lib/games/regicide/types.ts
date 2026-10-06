import type { Card, Suit } from '$lib/platform/types/index';

export type RegicidePhase = 'play' | 'defend' | 'victory' | 'defeat';

export interface Enemy {
	readonly card: Card;
	readonly maxHealth: number;
	readonly baseAttack: number;
	readonly currentHealth: number;
	readonly attackReduction: number;
	readonly immunityBroken: boolean;
}

export interface RegicideState {
	readonly phase: RegicidePhase;
	readonly currentEnemy: Enemy | null;
	readonly castleRemaining: number;
	readonly tavernSize: number;
	readonly discardSize: number;
	readonly currentPlayer: number;
	readonly enemyAttackDamage: number;
	readonly defenseNeeded: number;
	readonly defendingPlayer: number;
	readonly lastPlayedCards: readonly Card[];
	readonly lastSuitPowers: readonly string[];
}

export const ENEMY_STATS: Record<string, { health: number; attack: number }> = {
	'11': { health: 20, attack: 10 },
	'12': { health: 30, attack: 15 },
	'13': { health: 40, attack: 20 }
};

export const HAND_SIZES: Record<number, number> = {
	1: 8,
	2: 7,
	3: 6,
	4: 5
};

export const SUIT_POWER_NAMES: Record<Suit, string> = {
	clubs: 'Double Damage',
	spades: 'Reduce Attack',
	hearts: 'Recycle Cards',
	diamonds: 'Draw Cards'
};

const CARD_ATTACK_OVERRIDES: Record<number, number> = {
	11: 10,
	12: 15,
	13: 20,
	14: 1
};

export function cardAttackValue(card: Card): number {
	return CARD_ATTACK_OVERRIDES[card.rank] ?? card.rank;
}

function isAcePair(cards: readonly Card[]): boolean {
	return cards.length === 2 && cards.some((c) => c.rank === 14);
}

function isSameRankUnderLimit(cards: readonly Card[]): boolean {
	const ranks = cards.map((c) => c.rank);
	const allSame = ranks.every((r) => r === ranks[0]);
	if (!allSame) return false;
	const total = cards.reduce((s, c) => s + cardAttackValue(c), 0);
	return total <= 10;
}

export function isValidCombo(cards: readonly Card[]): boolean {
	if (cards.length <= 1) return cards.length === 1;
	if (isAcePair(cards)) return true;
	return isSameRankUnderLimit(cards);
}

export function comboAttackValue(cards: readonly Card[]): number {
	return cards.reduce((s, c) => s + cardAttackValue(c), 0);
}

export function comboSuits(cards: readonly Card[]): readonly Suit[] {
	return [...new Set(cards.map((c) => c.suit))];
}

export function isEnemyImmune(enemy: Enemy, suit: Suit): boolean {
	if (enemy.immunityBroken) return false;
	return enemy.card.suit === suit;
}
