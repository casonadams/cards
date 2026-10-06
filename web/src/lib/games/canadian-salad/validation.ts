import type { Card, Hand } from '$lib/platform/types/index';
import { validatePlay, type PlayValidation } from '$lib/platform/engine/index';
import type { TurnState } from '$lib/platform/engine/index';

export interface MoveValidation extends PlayValidation {
	readonly error?: string;
}

export interface ValidateMoveParams {
	readonly hand: Hand;
	readonly card: Card;
	readonly ledSuit: string | null;
	readonly turnState: TurnState;
	readonly playerIndex: number;
}

export function validateMove(params: ValidateMoveParams): MoveValidation {
	if (params.turnState.currentIndex !== params.playerIndex) {
		return { valid: false, error: 'Not your turn' };
	}

	return validatePlay({ hand: params.hand, card: params.card, ledSuit: params.ledSuit });
}
