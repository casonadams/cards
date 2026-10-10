import { shuffle } from '$lib/platform/engine/shuffle';
import type { Card, Hand, Suit, Rank } from '$lib/platform/types/card';
import type { DealResult } from '$lib/platform/types/game-runtime';

const SUITS: readonly Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export function createStandardDeck(): Card[] {
	const deck: Card[] = [];
	for (const suit of SUITS) {
		for (const rank of RANKS) {
			deck.push({ suit, rank });
		}
	}
	return deck;
}

export function dealHearts(playerCount: number, seed: number): DealResult {
	const fullDeck = createStandardDeck();
	let deckToDeal = fullDeck;
	const removedCards: Card[] = [];

	if (playerCount === 3) {
		// In 3-player Hearts, remove 2 of Diamonds to deal 17 cards each (51 cards total)
		const removedCard: Card = { suit: 'diamonds', rank: 2 };
		removedCards.push(removedCard);
		deckToDeal = fullDeck.filter(
			(c) => !(c.suit === removedCard.suit && c.rank === removedCard.rank)
		);
	}

	const shuffled = shuffle(deckToDeal, seed);
	const cardsPerPlayer = Math.floor(deckToDeal.length / playerCount);
	const hands: Hand[] = [];

	for (let p = 0; p < playerCount; p++) {
		const start = p * cardsPerPlayer;
		hands.push(shuffled.slice(start, start + cardsPerPlayer));
	}

	return {
		hands,
		removedCards
	};
}
