import type { Hand, Suit } from '$lib/types/card';

const SUIT_ORDER: Record<Suit, number> = {
	spades: 0,
	hearts: 1,
	diamonds: 2,
	clubs: 3
};

const TRUMP_BOOST = -10;

function suitOrder(suit: Suit, trumpSuit: Suit | null | undefined): number {
	const base = SUIT_ORDER[suit];
	const isTrump = trumpSuit != null && suit === trumpSuit;
	return isTrump ? base + TRUMP_BOOST : base;
}

export function sortHand(hand: Hand, trumpSuit?: Suit | null): Hand {
	return [...hand].sort((a, b) => {
		const aOrder = suitOrder(a.suit, trumpSuit);
		const bOrder = suitOrder(b.suit, trumpSuit);
		if (aOrder !== bOrder) return aOrder - bOrder;
		return b.rank - a.rank;
	});
}
