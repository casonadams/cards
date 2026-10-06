import type { Card, Deck, Hand } from '../types/index.ts';
import { shuffle } from './shuffle.ts';

export function deal(deck: Deck, playerCount: number): readonly Hand[] {
	const cardsPerPlayer = Math.floor(deck.length / playerCount);

	return Array.from({ length: playerCount }, (_, i) =>
		deck.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer)
	);
}

export interface SeededDealResult {
	readonly hands: readonly Hand[];
	readonly removedCards: readonly Card[];
}

export interface DealWithSeedParams {
	readonly deck: Deck;
	readonly playerCount: number;
	readonly seed: number;
	readonly cardsToRemove?: readonly Card[];
}

function filterDeck(deck: Deck, cardsToRemove: readonly Card[]): Deck {
	return deck.filter((c) => !cardsToRemove.some((r) => r.suit === c.suit && r.rank === c.rank));
}

export function dealWithSeed(params: DealWithSeedParams): SeededDealResult {
	const { deck, playerCount, seed, cardsToRemove = [] } = params;
	const filtered = cardsToRemove.length > 0 ? filterDeck(deck, cardsToRemove) : deck;
	const shuffled = shuffle(filtered, seed);
	return { hands: deal(shuffled, playerCount), removedCards: cardsToRemove };
}
