import { dealEuchre } from './deal.ts';
import {
	getPlayableEuchreCards,
	resolveEuchreTrick,
	isRightBower,
	isLeftBower,
	isTrumpCard,
	getEuchreCardPower,
	getEffectiveSuit
} from './trick.ts';
import { extractCurrentTrickPlays } from '$lib/platform/engine/trick-helpers';
import type { AiMoveParams, AiMoveResult } from '$lib/platform/types/game-runtime';
import type { Card, Suit, TrickPlay } from '$lib/platform/types/card';
import type { EuchreRoundState } from './types.ts';

export function evaluateEuchreHand(hand: readonly Card[], potentialTrump: Suit): number {
	let score = 0;
	for (const card of hand) {
		if (isRightBower(card, potentialTrump)) {
			score += 3.0;
		} else if (isLeftBower(card, potentialTrump)) {
			score += 2.5;
		} else if (card.suit === potentialTrump) {
			score += card.rank === 14 ? 1.5 : 1.0;
		} else if (card.rank === 14) {
			// Off-suit Ace
			score += 1.0;
		}
	}
	return score;
}

export interface EuchreAiCallDecision {
	readonly shouldCall: boolean;
	readonly suit: Suit;
	readonly goAlone: boolean;
}

export function computeEuchreAiTrumpCall(params: {
	readonly hand: readonly Card[];
	readonly round: 1 | 2;
	readonly upcardSuit: Suit;
	readonly isDealer: boolean;
	readonly isStickDealer?: boolean;
}): EuchreAiCallDecision {
	const { hand, round, upcardSuit, isDealer, isStickDealer } = params;

	if (round === 1) {
		const score = evaluateEuchreHand(hand, upcardSuit);
		const threshold = isDealer ? 2.5 : 3.0;
		if (score >= threshold) {
			return {
				shouldCall: true,
				suit: upcardSuit,
				goAlone: score >= 7.5
			};
		}
		return { shouldCall: false, suit: upcardSuit, goAlone: false };
	}

	// Round 2
	const allSuits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
	const eligibleSuits = allSuits.filter((s) => s !== upcardSuit);

	let bestSuit = eligibleSuits[0];
	let bestScore = -1;

	for (const suit of eligibleSuits) {
		const score = evaluateEuchreHand(hand, suit);
		if (score > bestScore) {
			bestScore = score;
			bestSuit = suit;
		}
	}

	if (bestScore >= 2.5 || (isDealer && isStickDealer)) {
		return {
			shouldCall: true,
			suit: bestSuit,
			goAlone: bestScore >= 7.5
		};
	}

	return { shouldCall: false, suit: bestSuit, goAlone: false };
}

function areEuchrePartners(p1: string, p2: string, playerIds: readonly string[]): boolean {
	const idx1 = playerIds.indexOf(p1);
	const idx2 = playerIds.indexOf(p2);
	return (idx1 % 2) === (idx2 % 2);
}

export function computeEuchreAiMove(params: AiMoveParams): AiMoveResult | null {
	const { moves, seed, currentRound, playerIds, aiPlayerId, gameSpecific } = params;
	const aiIndex = playerIds.indexOf(aiPlayerId);
	if (aiIndex < 0) return null;

	const rs = gameSpecific as EuchreRoundState | undefined;
	const deal = dealEuchre(seed + currentRound);
	const trumpSuit: Suit = rs?.trumpSuit ?? deal.upcard.suit;

	// Check if this AI player is sitting out due to Go Alone!
	if (rs?.goingAlone && rs.partnerSittingOutId === aiPlayerId) {
		return null;
	}

	const activePlayerIds = rs?.goingAlone && rs.partnerSittingOutId
		? playerIds.filter((id) => id !== rs.partnerSittingOutId)
		: playerIds;
	const activeCount = activePlayerIds.length; // 4 normally, 3 if Go Alone

	if (moves.length >= 5 * activeCount) return null;

	const aiInitialHand = deal.hands[aiIndex] ?? [];
	const aiPlayedCards = moves.filter((m) => m.playerId === aiPlayerId).map((m) => m.card);
	const remainingHand = aiInitialHand.filter(
		(c) => !aiPlayedCards.some((p) => p.suit === c.suit && p.rank === c.rank)
	);
	if (remainingHand.length === 0) return null;

	const trickPlays = extractCurrentTrickPlays(moves, activeCount);
	const playable = getPlayableEuchreCards({
		hand: remainingHand,
		trickPlays,
		trumpSuit
	});

	if (playable.length === 0) return null;
	if (playable.length === 1) {
		return { playerId: aiPlayerId, card: playable[0] };
	}

	const isLead = trickPlays.length === 0;

	if (isLead) {
		// If holding dominant trump, lead trump to pull opponent trumps
		const trumps = playable.filter((c) => isTrumpCard(c, trumpSuit));
		if (trumps.length >= 2) {
			const sortedTrumps = [...trumps].sort(
				(a, b) =>
					getEuchreCardPower(b, trumpSuit, trumpSuit) -
					getEuchreCardPower(a, trumpSuit, trumpSuit)
			);
			return { playerId: aiPlayerId, card: sortedTrumps[0] };
		}

		// Otherwise lead off-suit Ace if held
		const offSuitAces = playable.filter((c) => !isTrumpCard(c, trumpSuit) && c.rank === 14);
		if (offSuitAces.length > 0) {
			return { playerId: aiPlayerId, card: offSuitAces[0] };
		}

		// Otherwise lead lowest off-suit card
		const offSuits = playable.filter((c) => !isTrumpCard(c, trumpSuit));
		const candidates = offSuits.length > 0 ? offSuits : playable;
		const sorted = [...candidates].sort((a, b) => a.rank - b.rank);
		return { playerId: aiPlayerId, card: sorted[0] };
	}

	// In-progress trick
	const currentWinner = resolveEuchreTrick(trickPlays, trumpSuit);
	const isPartnerWinning =
		currentWinner.winnerId !== aiPlayerId &&
		areEuchrePartners(aiPlayerId, currentWinner.winnerId, playerIds);

	if (isPartnerWinning) {
		// Partner is winning the trick -> DUCK! Play lowest legal card
		const ledEffectiveSuit = getEffectiveSuit(trickPlays[0].card, trumpSuit);
		const sorted = [...playable].sort(
			(a, b) =>
				getEuchreCardPower(a, trumpSuit, ledEffectiveSuit) -
				getEuchreCardPower(b, trumpSuit, ledEffectiveSuit)
		);
		return { playerId: aiPlayerId, card: sorted[0] };
	}

	// Opponent is winning
	// Find cards that can beat the current winning card
	const ledEffectiveSuit = getEffectiveSuit(trickPlays[0].card, trumpSuit);
	const winningPlays: TrickPlay[] = [...trickPlays];
	const winningCards = playable.filter((c) => {
		const test = [...winningPlays, { playerId: aiPlayerId, card: c }];
		return resolveEuchreTrick(test, trumpSuit).winnerId === aiPlayerId;
	});

	if (winningCards.length > 0) {
		// Win as cheaply as possible
		const sorted = [...winningCards].sort(
			(a, b) =>
				getEuchreCardPower(a, trumpSuit, ledEffectiveSuit) -
				getEuchreCardPower(b, trumpSuit, ledEffectiveSuit)
		);
		return { playerId: aiPlayerId, card: sorted[0] };
	}

	// Cannot win -> sluff lowest card
	const sorted = [...playable].sort(
		(a, b) =>
			getEuchreCardPower(a, trumpSuit, ledEffectiveSuit) -
			getEuchreCardPower(b, trumpSuit, ledEffectiveSuit)
	);
	return { playerId: aiPlayerId, card: sorted[0] };
}
