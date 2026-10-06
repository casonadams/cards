import { cardAttackValue } from './types.ts';
import { removeCardsFromHand, type GameState } from './engine.ts';
import { drawToHandSize } from './play-cards.ts';
import type { Card } from '$lib/platform/types/index';

function safeArray<T>(arr: readonly T[] | undefined): readonly T[] {
	return arr ?? [];
}

function advanceToPlayPhase(state: GameState): GameState {
	const nextPlayer = (state.currentPlayer + 1) % state.playerCount;
	return drawToHandSize({
		...state,
		phase: 'play',
		currentPlayer: nextPlayer,
		defenseNeeded: 0,
		defendingPlayer: 0
	});
}

function handleEmptyDefense(state: GameState): GameState {
	if (state.defenseNeeded === 0) return advanceToPlayPhase(state);
	const allEmpty = safeArray(state.hands).every((h) => safeArray(h).length === 0);
	if (allEmpty) return { ...state, phase: 'defeat' };
	const nextDefender = (state.defendingPlayer + 1) % state.playerCount;
	return { ...state, defendingPlayer: nextDefender };
}

function handleCardDefense(state: GameState, cards: readonly Card[]): GameState {
	const defenseValue = cards.reduce((sum, c) => sum + cardAttackValue(c), 0);
	const remaining = state.defenseNeeded - defenseValue;
	const newHands = safeArray(state.hands).map((h, i) =>
		i === state.defendingPlayer ? removeCardsFromHand(safeArray(h), cards) : [...safeArray(h)]
	);
	const newDiscard = [...state.discard, ...cards];
	if (remaining <= 0) {
		return advanceToPlayPhase({ ...state, hands: newHands, discard: newDiscard });
	}
	return handlePartialDefense({ state, newHands, newDiscard, remaining });
}

interface PartialDefenseParams {
	readonly state: GameState;
	readonly newHands: Card[][];
	readonly newDiscard: Card[];
	readonly remaining: number;
}

function handlePartialDefense(p: PartialDefenseParams): GameState {
	const nextDefender = (p.state.defendingPlayer + 1) % p.state.playerCount;
	const allEmpty = p.newHands.every((h) => safeArray(h).length === 0);
	if (allEmpty) {
		return { ...p.state, hands: p.newHands, discard: p.newDiscard, phase: 'defeat' };
	}
	return {
		...p.state,
		hands: p.newHands,
		discard: p.newDiscard,
		defenseNeeded: p.remaining,
		defendingPlayer: nextDefender
	};
}

export function defendWithCards(state: GameState, cards: readonly Card[]): GameState {
	if (state.phase !== 'defend') return state;
	if (cards.length === 0) return handleEmptyDefense(state);
	return handleCardDefense(state, cards);
}
