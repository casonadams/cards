import type { Card, Suit, TrickPlay } from '$lib/platform/types/card';

export function getSameColorSuit(suit: Suit): Suit {
	switch (suit) {
		case 'spades':
			return 'clubs';
		case 'clubs':
			return 'spades';
		case 'hearts':
			return 'diamonds';
		case 'diamonds':
			return 'hearts';
	}
}

export function isRightBower(card: Card, trumpSuit: Suit): boolean {
	return card.rank === 11 && card.suit === trumpSuit;
}

export function isLeftBower(card: Card, trumpSuit: Suit): boolean {
	return card.rank === 11 && card.suit === getSameColorSuit(trumpSuit);
}

export function isTrumpCard(card: Card, trumpSuit: Suit): boolean {
	return card.suit === trumpSuit || isLeftBower(card, trumpSuit);
}

export function getEffectiveSuit(card: Card, trumpSuit: Suit): Suit {
	if (isLeftBower(card, trumpSuit)) {
		return trumpSuit;
	}
	return card.suit;
}

export function getEuchreCardPower(
	card: Card,
	trumpSuit: Suit,
	ledEffectiveSuit: Suit
): number {
	if (isRightBower(card, trumpSuit)) {
		return 1000;
	}
	if (isLeftBower(card, trumpSuit)) {
		return 900;
	}
	if (card.suit === trumpSuit) {
		// Trump cards: A(14), K(13), Q(12), 10(10), 9(9)
		return 100 + card.rank;
	}

	const effectiveSuit = getEffectiveSuit(card, trumpSuit);
	if (effectiveSuit === ledEffectiveSuit) {
		return card.rank;
	}

	// Sluffed non-trump card
	return 0;
}

export interface PlayableEuchreParams {
	readonly hand: readonly Card[];
	readonly trickPlays: readonly TrickPlay[];
	readonly trumpSuit: Suit;
}

export function getPlayableEuchreCards(params: PlayableEuchreParams): readonly Card[] {
	const { hand, trickPlays, trumpSuit } = params;
	if (hand.length === 0) return [];

	if (trickPlays.length === 0) {
		// Leading: any card in hand can be led
		return hand;
	}

	const ledEffectiveSuit = getEffectiveSuit(trickPlays[0].card, trumpSuit);
	const matchingCards = hand.filter(
		(c) => getEffectiveSuit(c, trumpSuit) === ledEffectiveSuit
	);

	if (matchingCards.length > 0) {
		// Must follow suit!
		return matchingCards;
	}

	// Void in led suit: can play any card (trump or off-suit)
	return hand;
}

export interface EuchreTrickResult {
	readonly winnerId: string;
	readonly winningCard: Card;
}

export function resolveEuchreTrick(
	plays: readonly TrickPlay[],
	trumpSuit: Suit
): EuchreTrickResult {
	if (plays.length === 0) {
		throw new Error('Cannot resolve empty trick');
	}

	const ledEffectiveSuit = getEffectiveSuit(plays[0].card, trumpSuit);
	let highestPower = -1;
	let winningPlay = plays[0];

	for (const play of plays) {
		const power = getEuchreCardPower(play.card, trumpSuit, ledEffectiveSuit);
		if (power > highestPower) {
			highestPower = power;
			winningPlay = play;
		}
	}

	return {
		winnerId: winningPlay.playerId,
		winningCard: winningPlay.card
	};
}
