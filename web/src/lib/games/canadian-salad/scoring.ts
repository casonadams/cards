import type { TrickPlay } from '$lib/platform/engine/index';
import type { HandType } from './types.ts';

export interface PlayerTricks {
	readonly playerId: string;
	readonly tricks: readonly (readonly TrickPlay[])[];
	readonly isLastTrickWinner: boolean;
}

function countHearts(tricks: readonly (readonly TrickPlay[])[]): number {
	return tricks.flat().filter((p) => p.card.suit === 'hearts').length;
}

function countQueens(tricks: readonly (readonly TrickPlay[])[]): number {
	return tricks.flat().filter((p) => p.card.rank === 12).length;
}

function hasKingOfSpades(tricks: readonly (readonly TrickPlay[])[]): boolean {
	return tricks.flat().some((p) => p.card.suit === 'spades' && p.card.rank === 13);
}

function scoreTricks(pt: PlayerTricks): number {
	return pt.tricks.length * 10;
}

function scoreHearts(pt: PlayerTricks): number {
	return countHearts(pt.tricks) * 10;
}

function scoreQueens(pt: PlayerTricks): number {
	return countQueens(pt.tricks) * 25;
}

function scoreKingOfSpades(pt: PlayerTricks): number {
	return hasKingOfSpades(pt.tricks) ? 100 : 0;
}

function scoreLastTrick(pt: PlayerTricks): number {
	return pt.isLastTrickWinner ? 100 : 0;
}

const SCORERS: Record<HandType, (pt: PlayerTricks) => number> = {
	NO_TRICKS: scoreTricks,
	NO_HEARTS: scoreHearts,
	NO_QUEENS: scoreQueens,
	NO_KING_SPADES: scoreKingOfSpades,
	NO_LAST_TRICK: scoreLastTrick,
	COMBINATION: (pt) =>
		scoreTricks(pt) + scoreHearts(pt) + scoreQueens(pt) + scoreKingOfSpades(pt) + scoreLastTrick(pt)
};

export function scoreHand(
	handType: HandType,
	playerTricks: readonly PlayerTricks[]
): readonly { playerId: string; points: number }[] {
	const scorer = SCORERS[handType];
	return playerTricks.map((pt) => ({
		playerId: pt.playerId,
		points: scorer(pt)
	}));
}
