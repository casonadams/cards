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

const STATIC_STANDARD_DECK: readonly Card[] = createStandardDeck();
const STATIC_DOUBLE_DECK: readonly Card[] = [...STATIC_STANDARD_DECK, ...STATIC_STANDARD_DECK];

export function dealSpades(playerCount: number, seed: number): DealResult {
	if (playerCount === 6) {
		const shuffled = shuffle(STATIC_DOUBLE_DECK, seed);
		const cardsPerPlayer = 17;
		const totalDealt = playerCount * cardsPerPlayer; // 102
		const hands: Hand[] = [];

		for (let p = 0; p < playerCount; p++) {
			const start = p * cardsPerPlayer;
			hands.push(shuffled.slice(start, start + cardsPerPlayer));
		}

		// 2 burned/removed cards
		const removedCards = shuffled.slice(totalDealt);

		return {
			hands,
			removedCards
		};
	}

	if (playerCount === 5) {
		const deck50 = STATIC_STANDARD_DECK.filter(
			(c) => !(c.rank === 2 && (c.suit === 'clubs' || c.suit === 'diamonds'))
		);
		const shuffled = shuffle(deck50, seed);
		const cardsPerPlayer = 10;
		const hands: Hand[] = [];

		for (let p = 0; p < playerCount; p++) {
			const start = p * cardsPerPlayer;
			hands.push(shuffled.slice(start, start + cardsPerPlayer));
		}

		return {
			hands,
			removedCards: [
				{ suit: 'clubs', rank: 2 },
				{ suit: 'diamonds', rank: 2 }
			]
		};
	}

	// 4-player standard 52-card deck
	const shuffled = shuffle(STATIC_STANDARD_DECK, seed);
	const cardsPerPlayer = 13;
	const hands: Hand[] = [];

	for (let p = 0; p < playerCount; p++) {
		const start = p * cardsPerPlayer;
		hands.push(shuffled.slice(start, start + cardsPerPlayer));
	}

	return {
		hands,
		removedCards: []
	};
}

export function removePlayedCards(
	initialHand: readonly Card[],
	playedCards: readonly Card[]
): Card[] {
	const remaining = [...initialHand];
	for (const played of playedCards) {
		const idx = remaining.findIndex((c) => c.suit === played.suit && c.rank === played.rank);
		if (idx >= 0) {
			remaining.splice(idx, 1);
		}
	}
	return remaining;
}
