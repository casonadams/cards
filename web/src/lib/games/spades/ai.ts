import { dealSpades, removePlayedCards } from './deal.ts';
import { getPlayableSpadesCards, resolveSpadesTrick, doesSpadesCardBeatWinning } from './trick.ts';
import { getSpadesTeams } from './scoring.ts';
import {
	extractCurrentTrickPlays,
	computeTrickLeader,
	computeCurrentTurnIndex
} from '$lib/platform/engine/trick-helpers';
import type { AiMoveParams, AiMoveResult } from '$lib/platform/types/game-runtime';
import type { Card } from '$lib/platform/types/card';
import type { SpadesGameMode, SpadesPlayerBid, SpadesRoundState } from './types.ts';

export function evaluateSpadesHand(hand: readonly Card[]): {
	readonly recommendedBid: number;
	readonly canNil: boolean;
} {
	let quickTricks = 0;
	const spades = hand.filter((c) => c.suit === 'spades');
	const sideSuits = ['hearts', 'diamonds', 'clubs'] as const;

	// Spades length factor
	if (spades.length > 3) {
		quickTricks += spades.length - 3;
	}

	for (const suit of sideSuits) {
		const suitCards = hand.filter((c) => c.suit === suit);
		const ace = suitCards.find((c) => c.rank === 14);
		const king = suitCards.find((c) => c.rank === 13);
		const queen = suitCards.find((c) => c.rank === 12);

		if (ace) quickTricks += 1.0;
		if (king && suitCards.length >= 2) quickTricks += 0.7;
		if (queen && suitCards.length >= 3) quickTricks += 0.4;

		// Void / singleton bonus if we have trump
		if (suitCards.length <= 1 && spades.length >= 3) {
			quickTricks += 0.5;
		}
	}

	// Nil eligibility heuristic
	const highestCard = hand.reduce((max, c) => Math.max(max, c.rank), 0);
	const hasHighSpade = spades.some((c) => c.rank >= 10);
	const canNil = spades.length <= 2 && !hasHighSpade && highestCard <= 11;

	const recommendedBid = Math.max(1, Math.round(quickTricks));
	return { recommendedBid, canNil };
}

export function computeSpadesAiBid(params: {
	readonly hand: readonly Card[];
	readonly isTrailingBy180?: boolean;
}): SpadesPlayerBid & { playerId?: string } {
	const { hand } = params;
	const { recommendedBid, canNil } = evaluateSpadesHand(hand);

	if (canNil) {
		return { playerId: '', bidType: 'nil', amount: 0 };
	}

	return { playerId: '', bidType: 'regular', amount: recommendedBid };
}

function areTeammates(p1: string, p2: string, playerIds: readonly string[], mode: SpadesGameMode): boolean {
	const teams = getSpadesTeams(playerIds, mode);
	const t1 = teams.find((t) => t.playerIds.includes(p1));
	const t2 = teams.find((t) => t.playerIds.includes(p2));
	return t1 !== undefined && t1 === t2;
}

export function computeSpadesAiMove(params: AiMoveParams): AiMoveResult | null {
	const { moves, seed, currentRound, playerCount, playerIds, aiPlayerId, gameSpecific, dealerIndex } =
		params;
	const aiIndex = playerIds.indexOf(aiPlayerId);
	if (aiIndex < 0) return null;

	const rs = gameSpecific as SpadesRoundState | undefined;
	const mode: SpadesGameMode = rs?.mode ?? (playerCount === 6 ? '6p_teams' : '4p_teams');

	const deal = dealSpades(playerCount, seed + currentRound);
	const cardsPerPlayer = deal.hands[0]?.length ?? 13;
	if (moves.length >= cardsPerPlayer * playerCount) return null;

	const leaderIdx = computeTrickLeader({
		moves,
		playerCount,
		playerIds,
		dealerIndex,
		resolveWinner: resolveSpadesTrick
	});
	const currentTurnIndex = computeCurrentTurnIndex(moves.length, playerCount, leaderIdx);
	if (currentTurnIndex !== aiIndex) return null;

	const aiInitialHand = deal.hands[aiIndex] ?? [];
	const aiPlayedCards = moves.filter((m) => m.playerId === aiPlayerId).map((m) => m.card);
	const remainingHand = removePlayedCards(aiInitialHand, aiPlayedCards);
	if (remainingHand.length === 0) return null;

	const trickPlays = extractCurrentTrickPlays(moves, playerCount);
	const playable = getPlayableSpadesCards({
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
		// Lead safe low card in longest side suit
		const nonSpades = playable.filter((c) => c.suit !== 'spades');
		const candidates = nonSpades.length > 0 ? nonSpades : playable;
		const sorted = [...candidates].sort((a, b) => a.rank - b.rank);
		return { playerId: aiPlayerId, card: sorted[0] };
	}

	// In-progress trick
	const currentWinner = resolveSpadesTrick(trickPlays);
	const isPartnerWinning =
		currentWinner.winnerId !== aiPlayerId &&
		areTeammates(aiPlayerId, currentWinner.winnerId, playerIds, mode);

	// Find if partner bid Nil
	const partnerBids = rs?.bids?.filter(
		(b) => b.playerId !== aiPlayerId && areTeammates(aiPlayerId, b.playerId, playerIds, mode)
	);
	const isPartnerNil = partnerBids?.some((b) => b.bidType === 'nil' || b.bidType === 'blind_nil') ?? false;

	// PARTNER COORDINATION:
	const ledSuit = trickPlays[0].card.suit;

	// 1. If partner is currently winning the trick:
	if (isPartnerWinning) {
		if (isPartnerNil) {
			// Partner bid Nil and is winning! We must OVERPLAY partner to rescue them!
			const winningCandidates = playable.filter((c) =>
				doesSpadesCardBeatWinning(c, currentWinner.winningCard, ledSuit)
			);
			if (winningCandidates.length > 0) {
				const sortedWinning = [...winningCandidates].sort((a, b) => a.rank - b.rank);
				return { playerId: aiPlayerId, card: sortedWinning[0] };
			}
		} else {
			// Partner has winning card and did NOT bid Nil -> DUCK!
			const sorted = [...playable].sort((a, b) => a.rank - b.rank);
			return { playerId: aiPlayerId, card: sorted[0] };
		}
	}

	// 2. Opponent is currently winning: Can we win the trick?
	const winningCards = playable.filter((c) =>
		doesSpadesCardBeatWinning(c, currentWinner.winningCard, ledSuit)
	);

	if (winningCards.length > 0) {
		// Win as cheaply as possible
		const sorted = [...winningCards].sort((a, b) => a.rank - b.rank);
		return { playerId: aiPlayerId, card: sorted[0] };
	}

	// Cannot win: play lowest card (sluff / discard)
	const sorted = [...playable].sort((a, b) => a.rank - b.rank);
	return { playerId: aiPlayerId, card: sorted[0] };
}
