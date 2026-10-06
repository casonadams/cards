import { comboAttackValue, comboSuits, isEnemyImmune, HAND_SIZES } from './types.ts';
import { applySuitPowers } from './suit-powers.ts';
import { createEnemy, removeCardsFromHand, type GameState } from './engine.ts';
import type { Card } from '$lib/platform/types/index';

function safeArray<T>(arr: readonly T[] | undefined): readonly T[] {
	return arr ?? [];
}

function fillHand(hand: Card[], ctx: { tavern: Card[]; maxSize: number }): void {
	while (hand.length < ctx.maxSize && ctx.tavern.length > 0) hand.push(ctx.tavern.shift()!);
}

function drawToHandSize(state: GameState): GameState {
	const maxSize = HAND_SIZES[state.playerCount] ?? 5;
	const newHands = safeArray(state.hands).map((h) => [...safeArray(h)]);
	const newTavern = [...safeArray(state.tavern)];
	newHands.forEach((h) => fillHand(h, { tavern: newTavern, maxSize }));
	return { ...state, hands: newHands, tavern: newTavern };
}

function flipNextEnemy(state: GameState): GameState {
	if (safeArray(state.castle).length === 0) {
		return { ...state, currentEnemy: null, phase: 'victory' };
	}
	const [next, ...rest] = state.castle;
	return { ...state, castle: rest, currentEnemy: createEnemy(next) };
}

function computeDamage(params: {
	currentEnemy: GameState['currentEnemy'];
	cards: readonly Card[];
}): number {
	const attackValue = comboAttackValue(params.cards);
	const suits = comboSuits(params.cards);
	const clubsActive = suits.includes('clubs') && !isEnemyImmune(params.currentEnemy!, 'clubs');
	return clubsActive ? attackValue * 2 : attackValue;
}

interface DefeatParams {
	readonly state: GameState;
	readonly cards: readonly Card[];
	readonly exactKill: boolean;
	readonly powers: readonly string[];
}

function handleDefeatedEnemy(p: DefeatParams): GameState {
	const enemyCard = p.state.currentEnemy!.card;
	const newDiscard = [...p.state.discard, ...p.cards];
	const nextPlayer = (p.state.currentPlayer + 1) % p.state.playerCount;
	const afterFlip = flipNextEnemy({
		...p.state,
		currentPlayer: nextPlayer,
		discard: p.exactKill ? newDiscard : [...newDiscard, enemyCard],
		tavern: p.exactKill ? [enemyCard, ...p.state.tavern] : p.state.tavern,
		lastPlayedCards: p.cards,
		lastSuitPowers: p.powers
	});
	return drawToHandSize(afterFlip);
}

interface SurviveParams {
	readonly state: GameState;
	readonly enemy: NonNullable<GameState['currentEnemy']>;
	readonly cards: readonly Card[];
	readonly newHealth: number;
	readonly powers: readonly string[];
}

function handleSurvivingEnemy(p: SurviveParams): GameState {
	const effectiveAttack = Math.max(0, p.enemy.baseAttack - p.enemy.attackReduction);
	return {
		...p.state,
		currentEnemy: { ...p.enemy, currentHealth: p.newHealth },
		phase: 'defend',
		defenseNeeded: effectiveAttack,
		defendingPlayer: p.state.currentPlayer,
		discard: [...p.state.discard, ...p.cards],
		lastPlayedCards: p.cards,
		lastSuitPowers: p.powers
	};
}

function isPlayable(
	state: GameState
): state is GameState & { currentEnemy: NonNullable<GameState['currentEnemy']> } {
	return state.currentEnemy !== null && state.phase === 'play';
}

function updateHands(state: GameState, cards: readonly Card[]): GameState {
	const newHands = safeArray(state.hands).map((h, i) =>
		i === state.currentPlayer ? removeCardsFromHand(safeArray(h), cards) : [...safeArray(h)]
	);
	return { ...state, hands: newHands };
}

export function playCards(state: GameState, cards: readonly Card[]): GameState {
	if (!isPlayable(state)) return state;
	const attackValue = comboAttackValue(cards);
	const damage = computeDamage({ currentEnemy: state.currentEnemy, cards });
	const s = updateHands(state, cards);
	const {
		enemy,
		state: afterPowers,
		powers
	} = applySuitPowers({
		state: s,
		enemy: state.currentEnemy,
		cards,
		attackValue
	});
	const newHealth = enemy.currentHealth - damage;
	if (newHealth <= 0) {
		return handleDefeatedEnemy({ state: afterPowers, cards, exactKill: newHealth === 0, powers });
	}
	return handleSurvivingEnemy({ state: afterPowers, enemy, cards, newHealth, powers });
}

export { drawToHandSize };
export { yieldTurn } from './yield-turn.ts';
