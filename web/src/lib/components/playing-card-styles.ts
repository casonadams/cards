import type { Suit, Rank, Card } from '$lib/types/card';

export const suitSymbols: Record<Suit, string> = {
	hearts: '\u2665',
	diamonds: '\u2666',
	clubs: '\u2663',
	spades: '\u2660'
};

export const suitBgColors: Record<Suit, string> = {
	hearts: 'bg-red-950',
	diamonds: 'bg-amber-950',
	clubs: 'bg-sky-950',
	spades: 'bg-slate-900'
};

export const suitTextColors: Record<Suit, string> = {
	hearts: 'text-red-300',
	diamonds: 'text-amber-300',
	clubs: 'text-sky-300',
	spades: 'text-slate-300'
};

export const faceLetters: Partial<Record<Rank, string>> = { 11: 'J', 12: 'Q', 13: 'K' };

export const sizes = {
	sm: 'w-[54px] h-[78px] sm:w-[66px] sm:h-[96px]',
	md: 'w-[62px] h-[90px] sm:w-[84px] sm:h-[122px]'
};

export const cornerSizes = { sm: 'text-[10px] sm:text-xs', md: 'text-xs sm:text-sm' };
export const centerSuitSizes = { sm: 'text-3xl sm:text-4xl', md: 'text-4xl sm:text-5xl' };
export const faceLetterSizes = { sm: 'text-3xl sm:text-4xl', md: 'text-4xl sm:text-5xl' };
export const aceSuitSizes = { sm: 'text-4xl sm:text-5xl', md: 'text-5xl sm:text-6xl' };

export const FACE_DOWN_BG = 'bg-blue-900 border-blue-700';

export function getCanadianPenalty(card: Card, handType: string): number {
	if (handType === 'NO_HEARTS' && card.suit === 'hearts') return 10;
	if (handType === 'NO_QUEENS' && card.rank === 12) return 25;
	if (handType === 'NO_KING_SPADES' && card.suit === 'spades' && card.rank === 13) return 100;
	if (handType === 'COMBINATION') {
		let p = 0;
		if (card.suit === 'hearts') p += 10;
		if (card.rank === 12) p += 25;
		if (card.suit === 'spades' && card.rank === 13) p += 100;
		return p;
	}
	return 0;
}
