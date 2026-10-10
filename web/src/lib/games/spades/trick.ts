import type { Card, Move, TrickPlay } from '$lib/platform/types/card';

export function isSpadesBroken(moves: readonly Move[], playerCount = 4): boolean {
	for (let i = 0; i < moves.length; i += playerCount) {
		const ledSuit = moves[i]?.card.suit;
		if (ledSuit === 'spades') return true;
		const end = Math.min(moves.length, i + playerCount);
		for (let j = i + 1; j < end; j++) {
			if (moves[j]?.card.suit === 'spades') return true;
		}
	}
	return false;
}

export interface PlayableSpadesParams {
	readonly hand: readonly Card[];
	readonly moves: readonly Move[];
	readonly trickPlays: readonly TrickPlay[];
	readonly playerCount?: number;
}

export function getPlayableSpadesCards(params: PlayableSpadesParams): readonly Card[] {
	const { hand, moves, trickPlays, playerCount = 4 } = params;
	if (hand.length === 0) return [];

	const isLead = trickPlays.length === 0;

	if (isLead) {
		const spadesBroken = isSpadesBroken(moves, playerCount);
		const hasOnlySpades = hand.every((c) => c.suit === 'spades');

		if (spadesBroken || hasOnlySpades) {
			return hand;
		}

		// Cannot lead spades
		const nonSpades = hand.filter((c) => c.suit !== 'spades');
		return nonSpades.length > 0 ? nonSpades : hand;
	}

	// Following a lead
	const ledSuit = trickPlays[0].card.suit;
	const sameSuit = hand.filter((c) => c.suit === ledSuit);

	if (sameSuit.length > 0) {
		return sameSuit;
	}

	// Void in led suit: any card in hand can be played
	return hand;
}

export interface SpadesTrickResult {
	readonly winnerId: string;
	readonly winningCard: Card;
}

export function doesSpadesCardBeatWinning(
	candidate: Card,
	currentWinningCard: Card,
	ledSuit: string
): boolean {
	if (currentWinningCard.suit === 'spades') {
		return candidate.suit === 'spades' && candidate.rank >= currentWinningCard.rank;
	}
	if (candidate.suit === 'spades') {
		return true;
	}
	return candidate.suit === ledSuit && candidate.rank >= currentWinningCard.rank;
}

export function resolveSpadesTrick(plays: readonly TrickPlay[]): SpadesTrickResult {
	if (plays.length === 0) {
		throw new Error('Cannot resolve empty trick');
	}

	// Check if any Spades were played
	const spadePlays = plays.filter((p) => p.card.suit === 'spades');

	if (spadePlays.length > 0) {
		// Find highest rank Spade
		let highestRank = -1;
		for (const p of spadePlays) {
			if (p.card.rank > highestRank) {
				highestRank = p.card.rank;
			}
		}

		// In double deck (or identical cards), second duplicate played wins identical ties!
		// We find the last play in chronological order that has this highest rank.
		let winningPlay = spadePlays[0];
		for (let i = plays.length - 1; i >= 0; i--) {
			const p = plays[i];
			if (p.card.suit === 'spades' && p.card.rank === highestRank) {
				winningPlay = p;
				break;
			}
		}

		return {
			winnerId: winningPlay.playerId,
			winningCard: winningPlay.card
		};
	}

	// No Spades played; led suit determines winner
	const ledSuit = plays[0].card.suit;
	const ledSuitPlays = plays.filter((p) => p.card.suit === ledSuit);

	let highestRank = -1;
	for (const p of ledSuitPlays) {
		if (p.card.rank > highestRank) {
			highestRank = p.card.rank;
		}
	}

	// Last duplicate card played wins ties
	let winningPlay = ledSuitPlays[0];
	for (let i = plays.length - 1; i >= 0; i--) {
		const p = plays[i];
		if (p.card.suit === ledSuit && p.card.rank === highestRank) {
			winningPlay = p;
			break;
		}
	}

	return {
		winnerId: winningPlay.playerId,
		winningCard: winningPlay.card
	};
}
