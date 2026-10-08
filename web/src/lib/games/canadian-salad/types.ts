import type { Card } from '$lib/platform/types/index';

export type HandType =
	| 'NO_TRICKS'
	| 'NO_HEARTS'
	| 'NO_QUEENS'
	| 'NO_KING_SPADES'
	| 'NO_LAST_TRICK'
	| 'COMBINATION';

export const HAND_SEQUENCE: readonly HandType[] = [
	'NO_TRICKS',
	'NO_HEARTS',
	'NO_QUEENS',
	'NO_KING_SPADES',
	'NO_LAST_TRICK',
	'COMBINATION'
];

export const HAND_LABELS: Record<HandType, string> = {
	NO_TRICKS: 'No Tricks',
	NO_HEARTS: 'No Hearts',
	NO_QUEENS: 'No Queens',
	NO_KING_SPADES: 'No King of Spades',
	NO_LAST_TRICK: 'No Last Trick',
	COMBINATION: 'Combination'
};

export const HAND_RULES: Record<HandType, string> = {
	NO_TRICKS: 'Avoid winning tricks: +10 penalty pts per trick. (Lowest total score wins)',
	NO_HEARTS: 'Avoid hearts: +10 penalty pts per heart card collected.',
	NO_QUEENS: 'Avoid queens: +25 penalty pts per Queen collected.',
	NO_KING_SPADES: 'Avoid the King of Spades: +100 penalty pts for collecting the K♠.',
	NO_LAST_TRICK: 'Avoid the final trick: +100 penalty pts for winning the last trick of the hand.',
	COMBINATION: 'All penalties active: Tricks (+10), Hearts (+10 ea), Queens (+25 ea), K♠ (+100), Last Trick (+100).'
};

export interface PlayerCountConfig {
	readonly cardsToRemove: readonly Card[];
	readonly cardsPerPlayer: number;
}

export const PLAYER_COUNT_CONFIGS: Record<number, PlayerCountConfig> = {
	3: { cardsToRemove: [{ suit: 'clubs', rank: 2 }], cardsPerPlayer: 17 },
	4: { cardsToRemove: [], cardsPerPlayer: 13 },
	5: {
		cardsToRemove: [
			{ suit: 'clubs', rank: 2 },
			{ suit: 'diamonds', rank: 2 }
		],
		cardsPerPlayer: 10
	},
	6: {
		cardsToRemove: [
			{ suit: 'clubs', rank: 2 },
			{ suit: 'clubs', rank: 3 },
			{ suit: 'diamonds', rank: 2 },
			{ suit: 'diamonds', rank: 3 }
		],
		cardsPerPlayer: 8
	}
};

const PENALTY_FNS: Record<HandType, (card: Card) => number> = {
	NO_TRICKS: () => 0,
	NO_HEARTS: (card) => (card.suit === 'hearts' ? 10 : 0),
	NO_QUEENS: (card) => (card.rank === 12 ? 25 : 0),
	NO_KING_SPADES: (card) => (card.suit === 'spades' && card.rank === 13 ? 100 : 0),
	NO_LAST_TRICK: () => 0,
	COMBINATION: (card) => {
		return (
			PENALTY_FNS.NO_HEARTS(card) + PENALTY_FNS.NO_QUEENS(card) + PENALTY_FNS.NO_KING_SPADES(card)
		);
	}
};

export function getCardPenalty(card: Card, handType: HandType): number {
	const fn = PENALTY_FNS[handType];
	return fn ? fn(card) : 0;
}
