import type { Card, Deck, Hand } from '$lib/platform/types/card';
import type { DealResult } from '$lib/platform/types/game-runtime';
import { shuffle } from '$lib/platform/engine/shuffle';

const SUITS: readonly Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: readonly Card['rank'][] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export function createStandardDeck(): Deck {
	const deck: Card[] = [];
	for (const suit of SUITS) {
		for (const rank of RANKS) {
			deck.push({ suit, rank });
		}
	}
	return deck;
}

export interface CribbageDealResult extends DealResult {
	readonly starterCard: Card;
	readonly remainderDeck: readonly Card[];
}

export function dealCribbage(seed: number, currentRound = 0): CribbageDealResult {
	const deck = createStandardDeck();
	const shuffled = shuffle(deck, seed + currentRound);

	const hand0: Hand = shuffled.slice(0, 6);
	const hand1: Hand = shuffled.slice(6, 12);
	const starterCard = shuffled[12];
	const remainderDeck = shuffled.slice(13);

	return {
		hands: [hand0, hand1],
		removedCards: [],
		starterCard,
		remainderDeck
	};
}
