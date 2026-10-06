export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
	readonly suit: Suit;
	readonly rank: Rank;
}

export type Hand = readonly Card[];

export const RANK_NAMES: Record<Rank, string> = {
	2: '2',
	3: '3',
	4: '4',
	5: '5',
	6: '6',
	7: '7',
	8: '8',
	9: '9',
	10: '10',
	11: 'J',
	12: 'Q',
	13: 'K',
	14: 'A'
};

export const SUIT_SYMBOLS: Record<Suit, string> = {
	hearts: '♥',
	diamonds: '♦',
	clubs: '♣',
	spades: '♠'
};
