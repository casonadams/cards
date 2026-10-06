import type { Suit, Rank } from '$lib/platform/types/index';
import type { RookCard } from '$lib/games/rook/types';
export const suitSymbols: Record<Suit, string> = {
	hearts: '♥',
	diamonds: '♦',
	clubs: '♣',
	spades: '♠'
};

export const suitBgColors: Record<Suit, string> = {
	hearts: 'bg-white',
	diamonds: 'bg-white',
	clubs: 'bg-white',
	spades: 'bg-white'
};

export const suitTextColors: Record<Suit, string> = {
	hearts: 'text-rose-600',
	diamonds: 'text-blue-600',
	clubs: 'text-emerald-700',
	spades: 'text-zinc-950'
};
export const faceLetters: Partial<Record<Rank, string>> = { 11: 'J', 12: 'Q', 13: 'K' };

export const rookBgColors = {
	black: 'bg-white',
	red: 'bg-white',
	green: 'bg-white',
	yellow: 'bg-white'
};

export const rookTextColors = {
	black: 'text-zinc-950',
	red: 'text-rose-600',
	green: 'text-emerald-600',
	yellow: 'text-amber-500'
};

export const sizes = {
	sm: 'w-[48px] h-[70px] sm:w-[60px] sm:h-[88px]',
	md: 'w-[56px] h-[82px] sm:w-[74px] sm:h-[108px]'
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

export const FACE_DOWN_BG = 'bg-slate-900 border-indigo-700/60 shadow-md';
export const ROOK_BIRD_BG = 'bg-white border-purple-500/50 shadow-md';

export function resolveRookBg(type: string, _color: string): string {
	if (type === 'bird') return ROOK_BIRD_BG;
	return 'bg-white border-zinc-200/90 shadow-md';
}
