import { shuffle } from '$lib/platform/engine/shuffle';
import type { Card, Hand, Suit, Rank } from '$lib/platform/types/card';
import type { DealResult } from '$lib/platform/types/game-runtime';
import {
	WIZARD_RANK,
	JESTER_RANK,
	isStandardCard,
	isJester,
	isWizard
} from './types.ts';

const SUITS: readonly Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const STANDARD_RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export function createWizardDeck(): Card[] {
	const deck: Card[] = [];

	// 52 standard cards
	for (const suit of SUITS) {
		for (const rank of STANDARD_RANKS) {
			deck.push({ suit, rank });
		}
	}

	// 4 Wizards (one per suit icon)
	for (const suit of SUITS) {
		deck.push({ suit, rank: WIZARD_RANK });
	}

	// 4 Jesters (one per suit icon)
	for (const suit of SUITS) {
		deck.push({ suit, rank: JESTER_RANK });
	}

	return deck; // exactly 60 cards
}

export interface WizardDealResult extends DealResult {
	readonly trumpCard: Card | null;
	readonly trumpSuit: Suit | null;
	readonly remainderDeck: readonly Card[];
}

export function dealWizard(params: {
	readonly playerCount: number;
	readonly currentRound: number;
	readonly seed: number;
	readonly dealerTrumpChoice?: Suit;
}): WizardDealResult {
	const { playerCount, currentRound, seed, dealerTrumpChoice } = params;
	const deck = createWizardDeck();
	const shuffled = shuffle(deck, seed);

	const cardsPerPlayer = currentRound + 1;
	const totalDealt = playerCount * cardsPerPlayer;

	const hands: Hand[] = [];
	for (let p = 0; p < playerCount; p++) {
		const start = p * cardsPerPlayer;
		hands.push(shuffled.slice(start, start + cardsPerPlayer));
	}

	const remainderDeck = shuffled.slice(totalDealt);
	let trumpCard: Card | null = null;
	let trumpSuit: Suit | null = null;

	if (remainderDeck.length > 0) {
		trumpCard = remainderDeck[0];
		if (isStandardCard(trumpCard)) {
			trumpSuit = trumpCard.suit;
		} else if (isJester(trumpCard)) {
			// Jester turned up -> No Trump for the round!
			trumpSuit = null;
		} else if (isWizard(trumpCard)) {
			// Wizard turned up -> Dealer selects trump suit!
			trumpSuit = dealerTrumpChoice ?? 'hearts';
		}
	} else {
		// Final round: all 60 cards dealt -> No Trump!
		trumpCard = null;
		trumpSuit = null;
	}

	return {
		hands,
		removedCards: remainderDeck,
		remainderDeck,
		trumpCard,
		trumpSuit
	};
}
