import { createRookDeck } from './deck.ts';
import { cardId } from './deck.ts';
import { createSeededRandom } from '$lib/platform/engine/seeded-random';
import { CARDS_PER_PLAYER, NEST_SIZE, type RookCard } from './types.ts';

export interface RookDealResult {
	readonly hands: readonly (readonly RookCard[])[];
	readonly nest: readonly RookCard[];
}

function shuffleRookDeck(deck: readonly RookCard[], seed: number): RookCard[] {
	const cards = [...deck];
	const rng = createSeededRandom(seed);
	for (let i = cards.length - 1; i > 0; i--) {
		const j = Math.floor(rng.next() * (i + 1));
		[cards[i], cards[j]] = [cards[j], cards[i]];
	}
	return cards;
}

export function dealRook(playerCount: number, seed: number): RookDealResult {
	const deck = shuffleRookDeck(createRookDeck(), seed);
	const hands: RookCard[][] = Array.from({ length: playerCount }, () => []);
	const totalDealt = playerCount * CARDS_PER_PLAYER;
	for (let i = 0; i < totalDealt; i++) {
		hands[i % playerCount].push(deck[i]);
	}
	const nest = deck.slice(totalDealt, totalDealt + NEST_SIZE);
	return { hands, nest };
}

export function removeCards(hand: readonly RookCard[], played: readonly RookCard[]): RookCard[] {
	const playedIds = new Set(played.map(cardId));
	return hand.filter((c) => !playedIds.has(cardId(c)));
}
