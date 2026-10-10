import type { Card, Move, TrickPlay } from '$lib/platform/types/card';

export function isTwoOfClubs(card: Card): boolean {
	return card.suit === 'clubs' && card.rank === 2;
}

export function isQueenOfSpades(card: Card): boolean {
	return card.suit === 'spades' && card.rank === 12;
}

export function isPenaltyCard(card: Card): boolean {
	return card.suit === 'hearts' || isQueenOfSpades(card);
}

export function isHeartsBroken(moves: readonly Move[]): boolean {
	return moves.some((m) => m.card.suit === 'hearts');
}

export function findTwoOfClubsHolder(hands: readonly (readonly Card[])[]): number {
	for (let i = 0; i < hands.length; i++) {
		if (hands[i].some(isTwoOfClubs)) {
			return i;
		}
	}
	return 0;
}

export interface PlayableHeartsParams {
	readonly hand: readonly Card[];
	readonly moves: readonly Move[];
	readonly trickPlays: readonly TrickPlay[];
	readonly playerCount: number;
}

export function getPlayableHeartsCards(params: PlayableHeartsParams): readonly Card[] {
	const { hand, moves, trickPlays, playerCount } = params;
	if (hand.length === 0) return [];

	const isLead = trickPlays.length === 0;
	const isTrick1 = Math.floor(moves.length / playerCount) === 0;

	if (isLead) {
		if (isTrick1) {
			// On Trick 1, 2 of Clubs must lead
			const twoOfClubs = hand.find(isTwoOfClubs);
			return twoOfClubs ? [twoOfClubs] : hand;
		}

		// Subsequent trick leads: Hearts cannot lead until broken or player holds only hearts
		const heartsBroken = isHeartsBroken(moves);
		const hasOnlyHearts = hand.every((c) => c.suit === 'hearts');

		if (heartsBroken || hasOnlyHearts) {
			return hand;
		}

		// Cannot lead hearts
		const nonHearts = hand.filter((c) => c.suit !== 'hearts');
		return nonHearts.length > 0 ? nonHearts : hand;
	}

	// Following a lead
	const ledSuit = trickPlays[0].card.suit;
	const sameSuitCards = hand.filter((c) => c.suit === ledSuit);

	if (sameSuitCards.length > 0) {
		return sameSuitCards;
	}

	// Void in led suit
	if (isTrick1) {
		// Trick 1 penalty protection: no Hearts or Queen of Spades allowed
		// UNLESS player holds ONLY penalty cards
		const nonPenaltyCards = hand.filter((c) => !isPenaltyCard(c));
		if (nonPenaltyCards.length > 0) {
			return nonPenaltyCards;
		}
		// Exception: only holds penalty cards
		return hand;
	}

	// Not trick 1: can sluff any card
	return hand;
}

export interface HeartsTrickResult {
	readonly winnerId: string;
	readonly points: number;
	readonly heartsCount: number;
	readonly hasQueenOfSpades: boolean;
}

export function resolveHeartsTrick(plays: readonly TrickPlay[]): HeartsTrickResult {
	if (plays.length === 0) {
		throw new Error('Cannot resolve empty trick');
	}

	const ledSuit = plays[0].card.suit;
	let highestPlay = plays[0];

	let heartsCount = 0;
	let hasQueenOfSpades = false;

	for (const play of plays) {
		if (play.card.suit === 'hearts') {
			heartsCount++;
		}
		if (isQueenOfSpades(play.card)) {
			hasQueenOfSpades = true;
		}

		if (play.card.suit === ledSuit && play.card.rank > highestPlay.card.rank) {
			highestPlay = play;
		}
	}

	const points = heartsCount + (hasQueenOfSpades ? 13 : 0);

	return {
		winnerId: highestPlay.playerId,
		points,
		heartsCount,
		hasQueenOfSpades
	};
}
