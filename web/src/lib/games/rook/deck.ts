import { ROOK_COLORS, type RookCard, type NumberCard, type BirdCard } from './types.ts';

const BIRD_CARD: BirdCard = { type: 'bird' };
const KENTUCKY_MIN_VALUE = 5;
const FULL_MAX_VALUE = 14;

function createNumberCards(minValue: number): NumberCard[] {
	const cards: NumberCard[] = [];
	for (const color of ROOK_COLORS) {
		cards.push({ type: 'number', color, value: 1 });
		for (let value = minValue; value <= FULL_MAX_VALUE; value++) {
			cards.push({ type: 'number', color, value });
		}
	}
	return cards;
}

export function createRookDeck(): readonly RookCard[] {
	return [...createNumberCards(KENTUCKY_MIN_VALUE), BIRD_CARD];
}

export function cardId(card: RookCard): string {
	if (card.type === 'bird') return 'bird';
	return `${card.color}-${card.value}`;
}

export function isSameCard(a: RookCard, b: RookCard): boolean {
	return cardId(a) === cardId(b);
}
