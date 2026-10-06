import { removeCardsFromHand, type GameState } from './engine.ts';
import type { Card } from '$lib/platform/types/index';

function safeArray<T>(arr: readonly T[] | undefined): readonly T[] {
	return arr ?? [];
}

function pickDiscardCard(hand: readonly Card[]): Card | null {
	if (hand.length === 0) return null;
	return [...hand].sort((a, b) => a.rank - b.rank)[0];
}

interface YieldUpdate {
	readonly state: GameState;
	readonly playerIdx: number;
	readonly card: Card;
}

function applyYieldDiscard(u: YieldUpdate): GameState {
	const newHands = safeArray(u.state.hands).map((h, i) =>
		i === u.playerIdx ? removeCardsFromHand(safeArray(h), [u.card]) : [...safeArray(h)]
	);
	return { ...u.state, hands: newHands, discard: [...safeArray(u.state.discard), u.card] };
}

function drawOneFromTavern(state: GameState, playerIdx: number): GameState {
	if (safeArray(state.tavern).length === 0) return state;
	const [drawn, ...rest] = state.tavern;
	const newHands = safeArray(state.hands).map((h, i) =>
		i === playerIdx ? [...safeArray(h), drawn] : [...safeArray(h)]
	);
	return { ...state, hands: newHands, tavern: rest };
}

function computeEffectiveAttack(enemy: NonNullable<GameState['currentEnemy']>): number {
	return Math.max(0, enemy.baseAttack - enemy.attackReduction);
}

function swapOneCard(state: GameState): GameState {
	const hand = safeArray(state.hands)[state.currentPlayer] ?? [];
	const card = pickDiscardCard(hand);
	if (!card) return state;
	const after = applyYieldDiscard({ state, playerIdx: state.currentPlayer, card });
	return drawOneFromTavern(after, state.currentPlayer);
}

export function yieldTurn(state: GameState): GameState {
	if (!state.currentEnemy || state.phase !== 'play') return state;
	const s = swapOneCard(state);
	return {
		...s,
		phase: 'defend',
		defenseNeeded: computeEffectiveAttack(state.currentEnemy),
		defendingPlayer: state.currentPlayer,
		lastPlayedCards: [],
		lastSuitPowers: []
	};
}
