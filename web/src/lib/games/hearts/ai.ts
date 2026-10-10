import { dealHearts } from './deal.ts';
import {
	findTwoOfClubsHolder,
	getPlayableHeartsCards,
	isQueenOfSpades,
	resolveHeartsTrick
} from './trick.ts';
import {
	extractCurrentTrickPlays,
	computeCurrentTurnIndex
} from '$lib/platform/engine/trick-helpers';
import type { AiMoveParams, AiMoveResult } from '$lib/platform/types/game-runtime';
import type { Card, Move, TrickPlay } from '$lib/platform/types/card';

function computeHeartsTrickLeader(
	moves: readonly Move[],
	playerCount: number,
	playerIds: readonly string[],
	hands: readonly (readonly Card[])[]
): number {
	if (moves.length === 0) {
		return findTwoOfClubsHolder(hands);
	}
	const completedTricks = Math.floor(moves.length / playerCount);
	if (completedTricks === 0) {
		return findTwoOfClubsHolder(hands);
	}
	const lastEnd = completedTricks * playerCount;
	const lastTrickMoves = moves.slice(lastEnd - playerCount, lastEnd);
	const plays: TrickPlay[] = lastTrickMoves.map((m) => ({ playerId: m.playerId, card: m.card }));
	const { winnerId } = resolveHeartsTrick(plays);
	const winnerIdx = playerIds.indexOf(winnerId);
	return winnerIdx >= 0 ? winnerIdx : 0;
}

export function computeHeartsAiMove(params: AiMoveParams): AiMoveResult | null {
	const { moves, seed, currentRound, playerCount, playerIds, aiPlayerId } = params;
	const aiIndex = playerIds.indexOf(aiPlayerId);
	if (aiIndex < 0) return null;

	const deal = dealHearts(playerCount, seed + currentRound);
	const cardsPerPlayer = deal.hands[0]?.length ?? 13;
	if (moves.length >= cardsPerPlayer * playerCount) return null;

	const leaderIdx = computeHeartsTrickLeader(moves, playerCount, playerIds, deal.hands);
	const currentTurnIndex = computeCurrentTurnIndex(moves.length, playerCount, leaderIdx);
	if (currentTurnIndex !== aiIndex) return null;

	const aiInitialHand = deal.hands[aiIndex] ?? [];
	const aiPlayedCards = moves.filter((m) => m.playerId === aiPlayerId).map((m) => m.card);
	const remainingHand = aiInitialHand.filter(
		(c) => !aiPlayedCards.some((p) => p.suit === c.suit && p.rank === c.rank)
	);
	if (remainingHand.length === 0) return null;

	const trickPlays = extractCurrentTrickPlays(moves, playerCount);
	const playable = getPlayableHeartsCards({
		hand: remainingHand,
		moves,
		trickPlays,
		playerCount
	});
	if (playable.length === 0) return null;
	if (playable.length === 1) {
		return { playerId: aiPlayerId, card: playable[0] };
	}

	const isLead = trickPlays.length === 0;

	if (isLead) {
		// Lead decision
		// Prefer low cards in safe suits (diamonds, clubs)
		const safeCards = playable.filter((c) => c.suit !== 'hearts' && !isQueenOfSpades(c));
		if (safeCards.length > 0) {
			// Avoid leading high spades (A, K) if Q♠ not played yet
			const qSpadesPlayed = moves.some((m) => isQueenOfSpades(m.card));
			const nonDangerCards = safeCards.filter(
				(c) => qSpadesPlayed || !(c.suit === 'spades' && c.rank >= 12)
			);
			const candidates = nonDangerCards.length > 0 ? nonDangerCards : safeCards;
			// Sort ascending by rank to lead low
			const sorted = [...candidates].sort((a, b) => a.rank - b.rank);
			return { playerId: aiPlayerId, card: sorted[0] };
		}
		// If only hearts or Q♠, lead lowest
		const sorted = [...playable].sort((a, b) => a.rank - b.rank);
		return { playerId: aiPlayerId, card: sorted[0] };
	}

	// Following
	const ledSuit = trickPlays[0].card.suit;
	const isFollowingSuit = playable.some((c) => c.suit === ledSuit);

	if (isFollowingSuit) {
		const sameSuitCards = playable.filter((c) => c.suit === ledSuit);
		const trickPoints = trickPlays.reduce(
			(acc, p) => acc + (p.card.suit === 'hearts' ? 1 : isQueenOfSpades(p.card) ? 13 : 0),
			0
		);

		// Current highest card of led suit in trick
		const highestInTrick = trickPlays
			.filter((p) => p.card.suit === ledSuit)
			.reduce((max, p) => Math.max(max, p.card.rank), 0);

		const underCards = sameSuitCards.filter((c) => c.rank < highestInTrick);

		if (trickPoints > 0) {
			// Penalty points in trick! Duck if possible
			if (underCards.length > 0) {
				// Play highest under card to dump high rank safely
				const sortedUnder = [...underCards].sort((a, b) => b.rank - a.rank);
				return { playerId: aiPlayerId, card: sortedUnder[0] };
			}
			// Forced to win trick or play over: play lowest card of suit
			const sortedAll = [...sameSuitCards].sort((a, b) => a.rank - b.rank);
			return { playerId: aiPlayerId, card: sortedAll[0] };
		}

		// No penalty points yet
		const isLastPlayer = trickPlays.length === playerCount - 1;
		if (isLastPlayer) {
			// Last player and 0 points: safe to win if desired, or play highest card if safe
			// Safe to dump highest card
			const sortedAll = [...sameSuitCards].sort((a, b) => b.rank - a.rank);
			return { playerId: aiPlayerId, card: sortedAll[0] };
		}

		// Not last player: duck under if possible, otherwise play lowest
		if (underCards.length > 0) {
			const sortedUnder = [...underCards].sort((a, b) => b.rank - a.rank);
			return { playerId: aiPlayerId, card: sortedUnder[0] };
		}
		const sortedAll = [...sameSuitCards].sort((a, b) => a.rank - b.rank);
		return { playerId: aiPlayerId, card: sortedAll[0] };
	}

	// Void in led suit: SLUFF!
	// 1. Dump Queen of Spades if playable
	const qSpades = playable.find(isQueenOfSpades);
	if (qSpades) {
		return { playerId: aiPlayerId, card: qSpades };
	}

	// 2. Dump highest Hearts
	const hearts = playable.filter((c) => c.suit === 'hearts');
	if (hearts.length > 0) {
		const sortedHearts = [...hearts].sort((a, b) => b.rank - a.rank);
		return { playerId: aiPlayerId, card: sortedHearts[0] };
	}

	// 3. Dump high off-suit cards (Aces, Kings)
	const sortedHigh = [...playable].sort((a, b) => b.rank - a.rank);
	return { playerId: aiPlayerId, card: sortedHigh[0] };
}
