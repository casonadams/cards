import type { Card, Deck } from '../types/index.ts';
import { createSeededRandom } from './seeded-random.ts';

interface SwapParams {
	cards: Card[];
	i: number;
	rng: { next(): number } | undefined;
}

function swapAt(p: SwapParams): void {
	const rand = p.rng ? p.rng.next() : Math.random();
	const j = Math.floor(rand * (p.i + 1));
	[p.cards[p.i], p.cards[j]] = [p.cards[j], p.cards[p.i]];
}

export function shuffle(deck: Deck, seed?: number): Deck {
	const cards = [...deck];
	const rng = seed !== undefined ? createSeededRandom(seed) : undefined;

	for (let i = cards.length - 1; i > 0; i--) {
		swapAt({ cards, i, rng });
	}

	return cards;
}
