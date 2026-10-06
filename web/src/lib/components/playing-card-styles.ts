import type { Suit, Rank } from '$lib/platform/types/index';
import type { RookCard } from '$lib/games/rook/types';
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

export const rookBgColors = {
	black: 'bg-gray-800',
	red: 'bg-red-900',
	green: 'bg-green-900',
	yellow: 'bg-yellow-900'
};

export const rookTextColors = {
	black: 'text-gray-200',
	red: 'text-red-200',
	green: 'text-green-200',
	yellow: 'text-yellow-200'
};

export const sizes = {
	sm: 'w-[54px] h-[78px] sm:w-[66px] sm:h-[96px]',
	md: 'w-[62px] h-[90px] sm:w-[84px] sm:h-[122px]'
};

export const cornerSizes = { sm: 'text-[10px] sm:text-xs', md: 'text-xs sm:text-sm' };
export const centerSuitSizes = { sm: 'text-3xl sm:text-4xl', md: 'text-4xl sm:text-5xl' };
export const faceLetterSizes = { sm: 'text-3xl sm:text-4xl', md: 'text-4xl sm:text-5xl' };
export const aceSuitSizes = { sm: 'text-4xl sm:text-5xl', md: 'text-5xl sm:text-6xl' };
export const rookValueSizes = { sm: 'text-2xl sm:text-3xl', md: 'text-3xl sm:text-4xl' };

const ROOK_NUMBER_POINTS: Record<number, number> = { 1: 15, 14: 10, 10: 10, 5: 5 };

export function getRookCardPoints(rook: RookCard): number {
	if (rook.type === 'bird') return 20;
	return ROOK_NUMBER_POINTS[rook.value] ?? 0;
}

export const FACE_DOWN_BG = 'bg-blue-900 border-blue-700';
export const ROOK_BIRD_BG = 'bg-purple-900 border-purple-600';

export function resolveRookBg(type: string, color: string): string {
	if (type === 'bird') return ROOK_BIRD_BG;
	return `${rookBgColors[color as keyof typeof rookBgColors]} border-border`;
}
