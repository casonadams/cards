import { cardToRook } from './card-adapter.ts';
import type { Card } from '$lib/platform/types/index';
import type { RookCard, RookColor } from './types.ts';

const COLOR_ORDER: Record<RookColor, number> = {
	black: 0,
	red: 1,
	green: 2,
	yellow: 3
};

const TRUMP_BOOST = -10;
const BIRD_ORDER = -20;
const BIRD_VALUE = 99;

function colorOrder(card: RookCard, trumpColor: string | null | undefined): number {
	if (card.type === 'bird') return BIRD_ORDER;
	const boost = trumpColor === card.color ? TRUMP_BOOST : 0;
	return COLOR_ORDER[card.color] + boost;
}

function cardSortValue(card: RookCard): number {
	if (card.type === 'bird') return BIRD_VALUE;
	return card.value === 1 ? 15 : card.value;
}

export function sortRookHand(hand: readonly Card[], trumpColor?: string | null): readonly Card[] {
	return [...hand].sort((a, b) => {
		const ra = cardToRook(a);
		const rb = cardToRook(b);
		const orderDiff = colorOrder(ra, trumpColor) - colorOrder(rb, trumpColor);
		if (orderDiff !== 0) return orderDiff;
		return cardSortValue(rb) - cardSortValue(ra);
	});
}
