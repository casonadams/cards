import { cardAttackValue } from './types.ts';
import { parseGameState } from './parse-state.ts';
import type { Card } from '$lib/platform/types/index';
import type { GameState } from './engine.ts';

function pickPlayCards(
	hand: readonly Card[],
	enemy: { currentHealth: number; card: Card }
): Card[] {
	const sorted = [...hand].sort((a, b) => cardAttackValue(b) - cardAttackValue(a));
	const nonImmune = sorted.filter((c) => c.suit !== enemy.card.suit);
	const best = nonImmune.length > 0 ? nonImmune[0] : sorted[0];
	return best ? [best] : [];
}

function pickDefendCards(hand: readonly Card[], needed: number): Card[] {
	const sorted = [...hand].sort((a, b) => cardAttackValue(a) - cardAttackValue(b));
	const selected: Card[] = [];
	let total = 0;
	for (const c of sorted) {
		if (total >= needed) break;
		selected.push(c);
		total += cardAttackValue(c);
	}
	return selected;
}

export interface AiRegicideAction {
	readonly type: 'play' | 'defend' | 'yield';
	readonly cards: readonly Card[];
}

export interface AiActionParams {
	readonly gameSpecific: unknown;
	readonly playerCount: number;
	readonly aiIndex: number;
}

const YIELD_ACTION: AiRegicideAction = { type: 'yield', cards: [] };

function selectPlayCards(
	hand: readonly Card[],
	enemy: NonNullable<GameState['currentEnemy']>
): AiRegicideAction {
	const cards = pickPlayCards(hand, enemy);
	return cards.length > 0 ? { type: 'play', cards } : YIELD_ACTION;
}

function computePlayAction(
	hand: readonly Card[],
	enemy: GameState['currentEnemy']
): AiRegicideAction | null {
	if (hand.length === 0) return YIELD_ACTION;
	return enemy ? selectPlayCards(hand, enemy) : null;
}

function computeDefendAction(hand: readonly Card[], defenseNeeded: number): AiRegicideAction {
	if (hand.length === 0) return { type: 'defend', cards: [] };
	return { type: 'defend', cards: pickDefendCards(hand, defenseNeeded) };
}

function getHand(state: GameState, aiIndex: number): readonly Card[] {
	return state.hands[aiIndex] ?? [];
}

function isPlayTurn(state: GameState, aiIndex: number): boolean {
	return state.phase === 'play' && state.currentPlayer === aiIndex;
}

function isDefendTurn(state: GameState, aiIndex: number): boolean {
	return state.phase === 'defend' && state.defendingPlayer === aiIndex;
}

function resolveAction(state: GameState, aiIndex: number): AiRegicideAction | null {
	if (isPlayTurn(state, aiIndex))
		return computePlayAction(getHand(state, aiIndex), state.currentEnemy);
	if (isDefendTurn(state, aiIndex))
		return computeDefendAction(getHand(state, aiIndex), state.defenseNeeded);
	return null;
}

export function computeRegicideAiAction(params: AiActionParams): AiRegicideAction | null {
	const state = parseGameState(params.gameSpecific, params.playerCount);
	if (!state) return null;
	return resolveAction(state, params.aiIndex);
}
