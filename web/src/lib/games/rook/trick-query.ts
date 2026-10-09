import { cardToRook, rookToCard } from './card-adapter.ts';
import { isValidPlay } from './trick.ts';
import type { DeriveParams } from '$lib/platform/types/game-runtime';
import type { Card } from '$lib/platform/types/index';
import {
	type TrickPlay,
	extractCurrentTrickPlays,
	extractLastCompleteTrick
} from '$lib/platform/engine/index';
import type { RookCard, RookColor } from './types.ts';

export function getTrickPlays(params: DeriveParams): TrickPlay[] {
	return extractCurrentTrickPlays(params.moves, params.playerCount);
}

export function getLastTrick(params: DeriveParams): TrickPlay[] {
	return extractLastCompleteTrick(params.moves, params.playerCount);
}

function getLedColor(trickPlays: TrickPlay[], trump: RookColor): RookColor | null {
	if (trickPlays.length === 0) return null;
	const c = cardToRook(trickPlays[0].card);
	return c.type === 'bird' ? trump : c.color;
}

export interface PlayableCardsParams {
	readonly hand: readonly RookCard[];
	readonly isMyTurn: boolean;
	readonly trickPlays: TrickPlay[];
	readonly trump: RookColor;
}

export function getPlayableCards(params: PlayableCardsParams): readonly Card[] {
	if (!params.isMyTurn) return [];
	const ledColor = getLedColor(params.trickPlays, params.trump);
	return params.hand
		.filter((c) => isValidPlay({ card: c, hand: params.hand, ledColor }))
		.map(rookToCard);
}
