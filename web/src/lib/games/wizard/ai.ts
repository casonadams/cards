import { dealWizard } from './deal.ts';
import { getPlayableWizardCards, resolveWizardTrick } from './trick.ts';
import { isWizard, isJester } from './types.ts';
import {
	extractCurrentTrickPlays,
	computeTrickLeader,
	computeCurrentTurnIndex
} from '$lib/platform/engine/trick-helpers';
import type { AiMoveParams, AiMoveResult } from '$lib/platform/types/game-runtime';
import type { Card, Suit, TrickPlay } from '$lib/platform/types/card';
import type { WizardRoundState } from './types.ts';

export function evaluateWizardHand(
	hand: readonly Card[],
	trumpSuit: Suit | null
): number {
	let expected = 0;

	for (const card of hand) {
		if (isWizard(card)) {
			expected += 1.0;
		} else if (isJester(card)) {
			expected += 0.0;
		} else if (trumpSuit !== null && card.suit === trumpSuit) {
			if (card.rank >= 12) expected += 0.8;
			else if (card.rank >= 8) expected += 0.5;
			else expected += 0.2;
		} else if (card.rank === 14) {
			// Off-suit Ace
			expected += 0.5;
		} else {
			expected += 0.1;
		}
	}

	return Math.max(0, Math.round(expected));
}

export function computeWizardAiMove(params: AiMoveParams): AiMoveResult | null {
	const { moves, seed, currentRound, playerCount, playerIds, aiPlayerId, dealerIndex, gameSpecific } =
		params;
	const aiIndex = playerIds.indexOf(aiPlayerId);
	if (aiIndex < 0) return null;

	const rs = gameSpecific as WizardRoundState | undefined;
	const deal = dealWizard({ playerCount, currentRound, seed: seed + currentRound });
	const trumpSuit = rs?.trumpSuit ?? deal.trumpSuit;

	const cardsPerPlayer = currentRound + 1;
	if (moves.length >= cardsPerPlayer * playerCount) return null;

	const leaderIdx = computeTrickLeader({
		moves,
		playerCount,
		playerIds,
		dealerIndex,
		resolveWinner: (plays) => resolveWizardTrick(plays, trumpSuit)
	});
	const currentTurnIndex = computeCurrentTurnIndex(moves.length, playerCount, leaderIdx);
	if (currentTurnIndex !== aiIndex) return null;

	const aiInitialHand = deal.hands[aiIndex] ?? [];
	const aiPlayedCards = moves.filter((m) => m.playerId === aiPlayerId).map((m) => m.card);

	// Multi-set removal to handle potential duplicates safely
	const remainingHand = [...aiInitialHand];
	for (const played of aiPlayedCards) {
		const idx = remainingHand.findIndex((c) => c.suit === played.suit && c.rank === played.rank);
		if (idx >= 0) remainingHand.splice(idx, 1);
	}
	if (remainingHand.length === 0) return null;

	const trickPlays = extractCurrentTrickPlays(moves, playerCount);
	const playable = getPlayableWizardCards({
		hand: remainingHand,
		trickPlays
	});

	if (playable.length === 0) return null;
	if (playable.length === 1) {
		return { playerId: aiPlayerId, card: playable[0] };
	}

	// Determine bid and current tricks taken
	const playerBid = rs?.bids?.find((b) => b.playerId === aiPlayerId)?.bid ?? 0;
	let tricksWon = 0;
	const completedTricks = Math.floor(moves.length / playerCount);
	for (let t = 0; t < completedTricks; t++) {
		const trickMoves = moves.slice(t * playerCount, (t + 1) * playerCount);
		const plays: TrickPlay[] = trickMoves.map((m) => ({ playerId: m.playerId, card: m.card }));
		if (resolveWizardTrick(plays, trumpSuit).winnerId === aiPlayerId) {
			tricksWon++;
		}
	}

	const needsTricks = tricksWon < playerBid;
	const isLead = trickPlays.length === 0;

	if (isLead) {
		if (needsTricks) {
			// Lead Wizard if held and low card count, or high trump
			const nonWizards = playable.filter((c) => !isWizard(c));
			const wizards = playable.filter(isWizard);
			if (wizards.length > 0 && remainingHand.length <= 2) {
				return { playerId: aiPlayerId, card: wizards[0] };
			}
			// Lead high card
			const sorted = [...(nonWizards.length > 0 ? nonWizards : playable)].sort(
				(a, b) => b.rank - a.rank
			);
			return { playerId: aiPlayerId, card: sorted[0] };
		} else {
			// Do not want tricks!
			// Lead Jester if held!
			const jesters = playable.filter(isJester);
			if (jesters.length > 0) {
				return { playerId: aiPlayerId, card: jesters[0] };
			}
			// Avoid leading Wizards if possible
			const nonWizards = playable.filter((c) => !isWizard(c));
			const candidates = nonWizards.length > 0 ? nonWizards : playable;
			// Lead lowest card
			const sorted = [...candidates].sort((a, b) => a.rank - b.rank);
			return { playerId: aiPlayerId, card: sorted[0] };
		}
	}

	// In-progress trick
	const hasWizardInTrick = trickPlays.some((p) => isWizard(p.card));

	if (needsTricks) {
		if (hasWizardInTrick) {
			// Wizard already played by an earlier player! First wizard wins, so we CANNOT win!
			// Duck! Dump Jester or lowest card
			const jesters = playable.filter(isJester);
			if (jesters.length > 0) return { playerId: aiPlayerId, card: jesters[0] };
			const nonWizards = playable.filter((c) => !isWizard(c));
			const candidates = nonWizards.length > 0 ? nonWizards : playable;
			const sorted = [...candidates].sort((a, b) => a.rank - b.rank);
			return { playerId: aiPlayerId, card: sorted[0] };
		}

		// Can we win the trick?
		const winningPlays: TrickPlay[] = [...trickPlays];
		const winningCards = playable.filter((c) => {
			const test = [...winningPlays, { playerId: aiPlayerId, card: c }];
			return resolveWizardTrick(test, trumpSuit).winnerId === aiPlayerId;
		});

		if (winningCards.length > 0) {
			// Win with standard card if possible, otherwise Wizard
			const nonWizards = winningCards.filter((c) => !isWizard(c));
			if (nonWizards.length > 0) {
				const sorted = [...nonWizards].sort((a, b) => a.rank - b.rank);
				return { playerId: aiPlayerId, card: sorted[0] };
			}
			return { playerId: aiPlayerId, card: winningCards[0] };
		}

		// Cannot win -> sluff lowest card or Jester
		const jesters = playable.filter(isJester);
		if (jesters.length > 0) return { playerId: aiPlayerId, card: jesters[0] };
		const sorted = [...playable].sort((a, b) => a.rank - b.rank);
		return { playerId: aiPlayerId, card: sorted[0] };
	}

	// Do NOT need tricks
	// Play Jester if held
	const jesters = playable.filter(isJester);
	if (jesters.length > 0) {
		return { playerId: aiPlayerId, card: jesters[0] };
	}

	// Try to play a losing card
	const winningPlays: TrickPlay[] = [...trickPlays];
	const losingCards = playable.filter((c) => {
		const test = [...winningPlays, { playerId: aiPlayerId, card: c }];
		return resolveWizardTrick(test, trumpSuit).winnerId !== aiPlayerId;
	});

	if (losingCards.length > 0) {
		// Dump highest losing card (excluding Wizards)
		const nonWizards = losingCards.filter((c) => !isWizard(c));
		const candidates = nonWizards.length > 0 ? nonWizards : losingCards;
		const sorted = [...candidates].sort((a, b) => b.rank - a.rank);
		return { playerId: aiPlayerId, card: sorted[0] };
	}

	// Forced to win or only have winners
	const sorted = [...playable].sort((a, b) => a.rank - b.rank);
	return { playerId: aiPlayerId, card: sorted[0] };
}
