import { createTurnState } from '$lib/platform/engine/index';
import { validateMove } from './validation.ts';
import type { Card, Hand } from '$lib/platform/types/index';

export interface PlayableCardsParams {
	readonly hand: Hand;
	readonly isMyTurn: boolean;
	readonly ledSuit: string | null;
	readonly myIndex: number;
	readonly playerCount: number;
}

export function getPlayableCards(params: PlayableCardsParams): readonly Card[] {
	if (!params.isMyTurn) return [];
	const turn = createTurnState(params.playerCount, params.myIndex);
	return params.hand.filter(
		(c) =>
			validateMove({
				hand: params.hand,
				card: c,
				ledSuit: params.ledSuit,
				turnState: turn,
				playerIndex: params.myIndex
			}).valid
	);
}
