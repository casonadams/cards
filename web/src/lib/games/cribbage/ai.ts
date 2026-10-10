import type { Card } from '$lib/platform/types/card';
import type { AiMoveParams, AiMoveResult } from '$lib/platform/types/game-runtime';
import { deriveCribbageState } from './derive-state.ts';
import { cardPipValue, evaluatePeggingPlay, scoreCribbageHand } from './scoring.ts';
import type { CribbageUiState } from './types.ts';

function evaluateCribPotential(c1: Card, c2: Card): number {
	let value = 0;
	// 5s are extremely valuable in crib
	if (c1.rank === 5) value += 3;
	if (c2.rank === 5) value += 3;
	// Pairs
	if (c1.rank === c2.rank) value += 3;
	// 15s
	if (cardPipValue(c1) + cardPipValue(c2) === 15) value += 4;
	// Consecutive
	const diff = Math.abs(c1.rank - c2.rank);
	if (diff === 1) value += 2;
	// Same suit flush potential
	if (c1.suit === c2.suit) value += 1;
	return value;
}

function evaluateHandPotential(hand: readonly Card[]): number {
	// Approximate expected score against an average starter card
	const dummyStarter: Card = { suit: 'hearts', rank: 10 };
	return scoreCribbageHand(hand, dummyStarter, false).total;
}

function chooseBestDiscard(
	hand: readonly Card[],
	isDealer: boolean
): Card {
	if (hand.length <= 2) return hand[0];

	let bestScore = -Infinity;
	let bestCard = hand[0];

	for (let i = 0; i < hand.length; i++) {
		for (let j = i + 1; j < hand.length; j++) {
			const c1 = hand[i];
			const c2 = hand[j];
			const remaining = hand.filter((_, idx) => idx !== i && idx !== j);

			const handVal = evaluateHandPotential(remaining);
			const cribVal = evaluateCribPotential(c1, c2);

			const totalVal = isDealer ? handVal + cribVal : handVal - cribVal;

			if (totalVal > bestScore) {
				bestScore = totalVal;
				bestCard = c1;
			}
		}
	}

	return bestCard;
}

function chooseBestPeggingPlay(
	playableCards: readonly Card[],
	history: readonly Card[],
	currentTotal: number
): Card {
	if (playableCards.length === 1) return playableCards[0];

	let bestScore = -Infinity;
	let bestCard = playableCards[0];

	for (const card of playableCards) {
		const evalPlay = evaluatePeggingPlay(history, card, currentTotal);
		let score = evalPlay.points * 3;

		// Defensive adjustments:
		const newTotal = evalPlay.newTotal;
		if (newTotal === 31 || newTotal === 15) {
			score += 4;
		}
		// Leaving count at 5 or 21 is dangerous (opponent 10-val makes 15 or 31)
		if (newTotal === 5 || newTotal === 21) {
			score -= 3;
		}

		// Prefer leading safe cards on 0 (Ace, 2, 3, 4)
		if (currentTotal === 0 && cardPipValue(card) <= 4) {
			score += 1;
		}

		if (score > bestScore) {
			bestScore = score;
			bestCard = card;
		}
	}

	return bestCard;
}

export function computeCribbageAiMove(params: AiMoveParams): AiMoveResult | null {
	const state = deriveCribbageState({
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

	const ui = state.gameSpecific as CribbageUiState;
	const isDealer = ui.dealerId === params.aiPlayerId;

	let chosenCard: Card;

	if (ui.phase === 'cribDiscard') {
		chosenCard = chooseBestDiscard(state.playableCards, isDealer);
	} else {
		chosenCard = chooseBestPeggingPlay(
			state.playableCards,
			ui.currentCountCards,
			ui.runningTotal
		);
	}

	return {
		playerId: params.aiPlayerId,
		card: chosenCard
	};
}
