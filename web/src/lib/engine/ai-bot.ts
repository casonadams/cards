import type { Card, Suit } from '$lib/types/card';

const AI_BOT_NAMES = [
	'Bot Alice',
	'Bot Bob',
	'Bot Carol',
	'Bot Dave',
	'Bot Eve',
	'Bot Frank',
	'Bot Grace'
];

export function getAiBotName(index: number): string {
	return AI_BOT_NAMES[index % AI_BOT_NAMES.length];
}

function isTrickCandidate(card: Card, trumpSuit: Suit | null): boolean {
	if (trumpSuit !== null && card.suit === trumpSuit) {
		return card.rank >= 9 || (card.rank >= 5 && Math.random() > 0.4);
	}
	return card.rank === 14 || (card.rank === 13 && Math.random() > 0.5);
}

export function computeAiOhWellBid(params: {
	hand: Card[];
	trumpSuit: Suit | null;
	cardsPerPlayer: number;
	hookBid: number | null;
}): number {
	const { hand, trumpSuit, cardsPerPlayer, hookBid } = params;
	const estimated = hand.filter((card) => isTrickCandidate(card, trumpSuit)).length;
	const bid = Math.min(estimated, cardsPerPlayer);
	if (hookBid !== null && bid === hookBid) {
		return bid > 0 ? bid - 1 : Math.min(bid + 1, cardsPerPlayer);
	}
	return bid;
}

export function pickAiCardToPlay(params: {
	hand: Card[];
	currentTrick: { card: Card }[];
	trumpSuit?: Suit | null;
	gameId?: string;
}): Card {
	const { hand, currentTrick, trumpSuit: _trumpSuit, gameId } = params;
	if (hand.length === 0) throw new Error('Hand is empty');

	// Determine legal cards
	let legal = hand;
	if (currentTrick.length > 0) {
		const ledSuit = currentTrick[0].card.suit;
		const matching = hand.filter((c) => c.suit === ledSuit);
		if (matching.length > 0) {
			legal = matching;
		}
	}

	if (legal.length === 1) return legal[0];

	// Canadian Salad AI: try to avoid taking penalties
	if (gameId === 'canadian-salad') {
		// Prefer playing low cards of led suit, or dumping dangerous high cards (Queen, King of Spades, Hearts)
		const safeLow = [...legal].sort((a, b) => a.rank - b.rank);
		return safeLow[0];
	}

	// Oh Well AI: play lowest legal card if conserving, or highest if trying to win
	const sorted = [...legal].sort((a, b) => b.rank - a.rank);
	return sorted[Math.floor(Math.random() * sorted.length)];
}
