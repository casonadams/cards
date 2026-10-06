import type { Card, Deck, Suit, Rank } from '../types/index.ts';

const SUITS: readonly Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

const RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export function createDeck(): Deck {
	return SUITS.flatMap((suit) => RANKS.map((rank): Card => ({ suit, rank })));
}

export function removeCards(deck: Deck, toRemove: readonly Card[]): Deck {
	return deck.filter((card) => !toRemove.some((r) => r.suit === card.suit && r.rank === card.rank));
}
