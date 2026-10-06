import { createDeck } from '$lib/platform/engine/index';
import { shuffle } from '$lib/platform/engine/index';
import type { Card, Suit, Hand } from '$lib/platform/types/index';

export interface OhWellDealResult {
	readonly hands: readonly Hand[];
	readonly trumpCard: Card | null;
	readonly trumpSuit: Suit | null;
}

interface DealParams {
	readonly playerCount: number;
	readonly cardsPerPlayer: number;
	readonly seed: number;
}

function dealHands(deck: readonly Card[], params: DealParams): Card[][] {
	const hands: Card[][] = Array.from({ length: params.playerCount }, () => []);
	const totalDealt = params.playerCount * params.cardsPerPlayer;
	for (let i = 0; i < totalDealt; i++) {
		hands[i % params.playerCount].push(deck[i]);
	}
	return hands;
}

function findTrumpCard(deck: readonly Card[], totalDealt: number): Card | null {
	return totalDealt < deck.length ? deck[totalDealt] : null;
}

export function dealOhWell(params: DealParams): OhWellDealResult {
	const deck = shuffle(createDeck(), params.seed);
	const hands = dealHands(deck, params);
	const totalDealt = params.playerCount * params.cardsPerPlayer;
	const trumpCard = findTrumpCard(deck, totalDealt);
	return { hands, trumpCard, trumpSuit: trumpCard?.suit ?? null };
}
