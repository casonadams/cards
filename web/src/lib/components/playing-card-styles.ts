import type { Suit, Rank } from '$lib/platform/types/index';
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
	clubs: 'text-emerald-600',
	spades: 'text-zinc-950'
};
export const faceLetters: Partial<Record<Rank, string>> = { 11: 'J', 12: 'Q', 13: 'K' };

export const sizes = {
	sm: 'w-[44px] h-[64px] sm:tall:w-[64px] sm:tall:h-[92px]',
	md: 'w-[52px] h-[76px] sm:tall:w-[80px] sm:tall:h-[116px]'
};
export const cornerSizes = { sm: 'text-[10px] sm:tall:text-xs', md: 'text-xs sm:tall:text-base' };
export const centerSuitSizes = { sm: 'text-xl sm:tall:text-2xl', md: 'text-2xl sm:tall:text-4xl' };
export const faceLetterSizes = { sm: 'text-2xl sm:tall:text-3xl', md: 'text-3xl sm:tall:text-5xl' };
export const numberSizes = { sm: 'text-xl sm:tall:text-2xl', md: 'text-2xl sm:tall:text-4xl' };
export const aceSuitSizes = { sm: 'text-3xl sm:tall:text-4xl', md: 'text-4xl sm:tall:text-6xl' };

export const FACE_DOWN_BG = 'bg-slate-900 border-indigo-700/60 shadow-md';
