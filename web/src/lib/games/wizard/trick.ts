import type { Card, Suit, TrickPlay } from '$lib/platform/types/card';
import { isWizard, isJester, isStandardCard } from './types.ts';

export function determineWizardLedSuit(plays: readonly TrickPlay[]): Suit | null {
	if (plays.length === 0) return null;

	const firstCard = plays[0].card;
	if (isWizard(firstCard)) {
		// If a Wizard was led, there is no suit to follow!
		return null;
	}

	if (isStandardCard(firstCard)) {
		return firstCard.suit;
	}

	// First card was a Jester. Look for the first standard card played.
	for (let i = 1; i < plays.length; i++) {
		const c = plays[i].card;
		if (isWizard(c)) {
			// A wizard does not establish a suit
			continue;
		}
		if (isStandardCard(c)) {
			return c.suit;
		}
	}

	// No standard card played yet
	return null;
}

export interface PlayableWizardParams {
	readonly hand: readonly Card[];
	readonly trickPlays: readonly TrickPlay[];
}

export function getPlayableWizardCards(params: PlayableWizardParams): readonly Card[] {
	const { hand, trickPlays } = params;
	if (hand.length === 0) return [];

	if (trickPlays.length === 0) {
		// Leading: any card can be led
		return hand;
	}

	const ledSuit = determineWizardLedSuit(trickPlays);
	if (ledSuit === null) {
		// No suit obligations (e.g. Wizard led or only Jesters played so far)
		return hand;
	}

	// A suit has been established!
	// Wizards and Jesters can ALWAYS be played regardless of suit held!
	const wizardsAndJesters = hand.filter((c) => isWizard(c) || isJester(c));
	const sameSuitCards = hand.filter((c) => isStandardCard(c) && c.suit === ledSuit);

	if (sameSuitCards.length > 0) {
		// Must follow suit with standard cards, or play a Wizard / Jester
		return [...wizardsAndJesters, ...sameSuitCards];
	}

	// Void in led suit: any card in hand can be played
	return hand;
}

export interface WizardTrickResult {
	readonly winnerId: string;
	readonly winningCard: Card;
}

export function resolveWizardTrick(
	plays: readonly TrickPlay[],
	trumpSuit: Suit | null
): WizardTrickResult {
	if (plays.length === 0) {
		throw new Error('Cannot resolve empty trick');
	}

	// 1. Wizards: The FIRST Wizard played wins the trick!
	const firstWizard = plays.find((p) => isWizard(p.card));
	if (firstWizard) {
		return {
			winnerId: firstWizard.playerId,
			winningCard: firstWizard.card
		};
	}

	// 2. Trumps: If trump suit is active, highest trump card wins
	if (trumpSuit !== null) {
		const trumpPlays = plays.filter(
			(p) => isStandardCard(p.card) && p.card.suit === trumpSuit
		);
		if (trumpPlays.length > 0) {
			let highestTrump = trumpPlays[0];
			for (let i = 1; i < trumpPlays.length; i++) {
				if (trumpPlays[i].card.rank > highestTrump.card.rank) {
					highestTrump = trumpPlays[i];
				}
			}
			return {
				winnerId: highestTrump.playerId,
				winningCard: highestTrump.card
			};
		}
	}

	// 3. Led Suit: Find established led suit
	const ledSuit = determineWizardLedSuit(plays);
	if (ledSuit !== null) {
		const ledSuitPlays = plays.filter(
			(p) => isStandardCard(p.card) && p.card.suit === ledSuit
		);
		if (ledSuitPlays.length > 0) {
			let highestLed = ledSuitPlays[0];
			for (let i = 1; i < ledSuitPlays.length; i++) {
				if (ledSuitPlays[i].card.rank > highestLed.card.rank) {
					highestLed = ledSuitPlays[i];
				}
			}
			return {
				winnerId: highestLed.playerId,
				winningCard: highestLed.card
			};
		}
	}

	// 4. If all cards played are Jesters (or no standard cards and no wizards)
	// The FIRST Jester played wins the trick!
	return {
		winnerId: plays[0].playerId,
		winningCard: plays[0].card
	};
}
