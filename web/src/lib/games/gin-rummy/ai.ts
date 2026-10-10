import type { Card } from '$lib/platform/types/card';
import type { AiMoveParams, AiMoveResult } from '$lib/platform/types/game-runtime';
import { deriveGinRummyState } from './derive-state.ts';
import {
	cardKey,
	findOptimalMelds,
	ginCardValue
} from './melds.ts';
import type { GinUiState } from './types.ts';

function evaluateBestDiscard(hand: readonly Card[]): { bestCard: Card; minDeadwood: number } {
	let minDeadwood = Infinity;
	let bestCard = hand[0];

	for (let i = 0; i < hand.length; i++) {
		const candidateDiscard = hand[i];
		const remaining = hand.filter((_, idx) => idx !== i);
		const partition = findOptimalMelds(remaining);
		const deadwood = partition.deadwoodPoints;

		if (
			deadwood < minDeadwood ||
			(deadwood === minDeadwood && ginCardValue(candidateDiscard) > ginCardValue(bestCard))
		) {
			minDeadwood = deadwood;
			bestCard = candidateDiscard;
		}
	}

	return { bestCard, minDeadwood };
}

export function computeGinRummyAiMove(params: AiMoveParams): AiMoveResult | null {
	const state = deriveGinRummyState({
		moves: params.moves,
		seed: params.seed,
		currentRound: params.currentRound,
		playerCount: params.playerCount,
		playerIds: params.playerIds,
		myId: params.aiPlayerId,
		dealerIndex: params.dealerIndex,
		gameSpecific: params.gameSpecific
	});

	if (!state.isMyTurn || state.playableCards.length === 0) {
		return null;
	}

	const ui = state.gameSpecific as GinUiState;

	if (ui.phase === 'draw') {
		const topDiscard = ui.topDiscard;
		if (topDiscard && state.playableCards.some((c) => cardKey(c) === cardKey(topDiscard))) {
			// Check if taking top discard improves hand
			const handWithDiscard = [...state.myRemainingHand, topDiscard];
			const { minDeadwood } = evaluateBestDiscard(handWithDiscard);

			if (minDeadwood < ui.myDeadwoodPoints - 2 || minDeadwood <= 10) {
				return {
					playerId: params.aiPlayerId,
					card: topDiscard
				};
			}
		}

		// Draw from stock
		const topStock = state.playableCards.find(
			(c) => !topDiscard || cardKey(c) !== cardKey(topDiscard)
		);
		const cardToDraw = topStock ?? state.playableCards[0];

		return {
			playerId: params.aiPlayerId,
			card: cardToDraw
		};
	}

	// Discard phase:
	const { bestCard } = evaluateBestDiscard(state.myRemainingHand);
	return {
		playerId: params.aiPlayerId,
		card: bestCard
	};
}
