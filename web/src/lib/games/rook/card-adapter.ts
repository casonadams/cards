import type { Card, Suit, Rank } from '$lib/platform/types/index';
import type { RookCard, RookColor } from './types.ts';

// Encoding: Rook colors map to standard suits.
// Kentucky Rook removes 2s, 3s, 4s so those ranks are free for special use.
// Rook value 1 (ace) -> rank 2 (unused in Kentucky).
// Bird card -> rank 3, suit spades (arbitrary, unused in Kentucky).

const COLOR_TO_SUIT: Record<RookColor, Suit> = {
	black: 'spades',
	red: 'hearts',
	green: 'clubs',
	yellow: 'diamonds'
};

const SUIT_TO_COLOR: Record<Suit, RookColor> = {
	spades: 'black',
	hearts: 'red',
	clubs: 'green',
	diamonds: 'yellow'
};

const ROOK_ACE_RANK: Rank = 2;
const BIRD_RANK: Rank = 3;
const BIRD_SUIT: Suit = 'spades';

export function rookToCard(rook: RookCard): Card {
	if (rook.type === 'bird') return { suit: BIRD_SUIT, rank: BIRD_RANK };
	const rank = rook.value === 1 ? ROOK_ACE_RANK : (rook.value as Rank);
	return { suit: COLOR_TO_SUIT[rook.color], rank };
}

function isBirdCard(card: Card): boolean {
	return card.rank === BIRD_RANK && card.suit === BIRD_SUIT;
}

export function cardToRook(card: Card): RookCard {
	if (isBirdCard(card)) return { type: 'bird' };
	const value = card.rank === ROOK_ACE_RANK ? 1 : card.rank;
	return { type: 'number', color: SUIT_TO_COLOR[card.suit], value };
}
