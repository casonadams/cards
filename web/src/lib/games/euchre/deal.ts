import { shuffle } from '$lib/platform/engine/shuffle';
import type { Card, Hand, Suit, Rank } from '$lib/platform/types/card';
import type { DealResult } from '$lib/platform/types/game-runtime';

const EUCHRE_SUITS: readonly Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const EUCHRE_RANKS: readonly Rank[] = [9, 10, 11, 12, 13, 14];

export function createEuchreDeck(): Card[] {
	const deck: Card[] = [];
	for (const suit of EUCHRE_SUITS) {
		for (const rank of EUCHRE_RANKS) {
			deck.push({ suit, rank });
		}
	}
	return deck;
}

export interface EuchreDealResult extends DealResult {
	readonly upcard: Card;
	readonly kitty: readonly Card[];
}

export function dealEuchre(seed: number): EuchreDealResult {
	const deck = createEuchreDeck();
	const shuffled = shuffle(deck, seed);

	const hands: Hand[] = [];
	for (let p = 0; p < 4; p++) {
		hands.push(shuffled.slice(p * 5, (p + 1) * 5));
	}

	const kitty = shuffled.slice(20);
	const upcard = kitty[0];

	return {
		hands,
		removedCards: kitty,
		kitty,
		upcard
	};
}
