import type { Card, Suit, Rank } from '$lib/platform/types/index';

const SUIT_MAP: Record<Suit, string> = {
	hearts: 'heart',
	diamonds: 'diamond',
	clubs: 'club',
	spades: 'spade'
};

const RANK_MAP: Record<Rank, string> = {
	2: '2',
	3: '3',
	4: '4',
	5: '5',
	6: '6',
	7: '7',
	8: '8',
	9: '9',
	10: '10',
	11: 'jack',
	12: 'queen',
	13: 'king',
	14: '1'
};

export function toSvgCardId(card: Card): string {
	return `${SUIT_MAP[card.suit]}_${RANK_MAP[card.rank]}`;
}
