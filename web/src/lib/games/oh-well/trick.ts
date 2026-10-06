import type { Card, Suit } from '$lib/platform/types/index';
import type { TrickPlay } from '$lib/platform/engine/index';

interface StrengthParams {
	readonly card: Card;
	readonly ledSuit: Suit;
	readonly trumpSuit: Suit | null;
}

function isTrumpCard(card: Card, trumpSuit: Suit | null): boolean {
	return trumpSuit !== null && card.suit === trumpSuit;
}

function trumpBonus(card: Card, trumpSuit: Suit | null): number {
	return isTrumpCard(card, trumpSuit) ? 100 : 0;
}

function isRelevantSuit(params: StrengthParams): boolean {
	return isTrumpCard(params.card, params.trumpSuit) || params.card.suit === params.ledSuit;
}

function cardStrength(params: StrengthParams): number {
	if (!isRelevantSuit(params)) return -1;
	return trumpBonus(params.card, params.trumpSuit) + params.card.rank;
}

export function resolveOhWellTrick(
	plays: readonly TrickPlay[],
	trumpSuit: Suit | null
): { winnerId: string; winningCard: Card } {
	const ledSuit = plays[0].card.suit;
	let best = plays[0];
	let bestStrength = cardStrength({ card: best.card, ledSuit, trumpSuit });
	for (let i = 1; i < plays.length; i++) {
		const s = cardStrength({ card: plays[i].card, ledSuit, trumpSuit });
		if (s > bestStrength) {
			best = plays[i];
			bestStrength = s;
		}
	}
	return { winnerId: best.playerId, winningCard: best.card };
}

export function canFollowSuit(hand: readonly Card[], ledSuit: Suit): boolean {
	return hand.some((c) => c.suit === ledSuit);
}

export interface ValidPlayParams {
	readonly card: Card;
	readonly hand: readonly Card[];
	readonly ledSuit: Suit | null;
}

export function isValidPlay(params: ValidPlayParams): boolean {
	if (!params.ledSuit) return true;
	if (params.card.suit === params.ledSuit) return true;
	return !canFollowSuit(params.hand, params.ledSuit);
}
