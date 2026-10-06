import type { Card, Hand } from '../types/index.ts';

export interface TrickPlay {
	readonly playerId: string;
	readonly card: Card;
}

export interface TrickResult {
	readonly plays: readonly TrickPlay[];
	readonly winnerId: string;
	readonly winningCard: Card;
}

export interface PlayValidation {
	readonly valid: boolean;
	readonly error?: string;
}

export interface ValidatePlayParams {
	readonly hand: Hand;
	readonly card: Card;
	readonly ledSuit: string | null;
}

function checkSuitFollow(params: ValidatePlayParams): PlayValidation {
	const hasLedSuit = params.hand.some((c) => c.suit === params.ledSuit);
	if (hasLedSuit && params.card.suit !== params.ledSuit) {
		return { valid: false, error: 'Must follow suit' };
	}
	return { valid: true };
}

export function validatePlay(params: ValidatePlayParams): PlayValidation {
	const hasCard = params.hand.some(
		(c) => c.suit === params.card.suit && c.rank === params.card.rank
	);
	if (!hasCard) return { valid: false, error: 'Card not in hand' };
	if (params.ledSuit === null) return { valid: true };
	return checkSuitFollow(params);
}

export function resolveTrick(plays: readonly TrickPlay[]): TrickResult {
	const ledSuit = plays[0].card.suit;
	const onSuitPlays = plays.filter((p) => p.card.suit === ledSuit);

	const winner = onSuitPlays.reduce((best, current) =>
		current.card.rank > best.card.rank ? current : best
	);

	return { plays, winnerId: winner.playerId, winningCard: winner.card };
}
