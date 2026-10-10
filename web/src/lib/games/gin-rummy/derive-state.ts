import type { Card, TrickPlay } from '$lib/platform/types/card';
import type { DeriveParams, DerivedState, PlayerStats } from '$lib/platform/types/game-runtime';
import type { ScoreEntry } from '$lib/platform/types/game';
import { dealGinRummy } from './deal.ts';
import {
	cardKey,
	evaluateGinRound,
	findOptimalMelds
} from './melds.ts';
import {
	GIN_TARGET_SCORE,
	type GinPhase,
	type GinRoundScoring,
	type GinUiState
} from './types.ts';

export interface GinEngineState {
	readonly phase: GinPhase;
	readonly dealerIndex: number;
	readonly nonDealerIndex: number;
	readonly player0Id: string;
	readonly player1Id: string;
	readonly currentTurnIndex: number;
	readonly hand0: readonly Card[];
	readonly hand1: readonly Card[];
	readonly discardPile: readonly Card[];
	readonly stockPile: readonly Card[];
	readonly knockerId: string | null;
	readonly isRoundComplete: boolean;
	readonly isGameOver: boolean;
	readonly cumulativeScores: Record<string, number>;
	readonly scoringResult?: GinRoundScoring;
}

export function computeGinEngineState(params: DeriveParams): GinEngineState {
	const { seed, currentRound, dealerIndex, playerIds, moves } = params;
	const deal = dealGinRummy(seed, currentRound);

	const player0Id = playerIds[0];
	const player1Id = playerIds[1];
	const nonDealerIndex = (dealerIndex + 1) % 2;

	let hand0: Card[] = [...deal.hands[0]];
	let hand1: Card[] = [...deal.hands[1]];
	const discardPile: Card[] = [deal.initialUpcard];
	const stockPile: Card[] = [...deal.initialStock];

	const cumulativeScores: Record<string, number> = {
		[player0Id]: 0,
		[player1Id]: 0
	};

	let currentTurnIndex = nonDealerIndex;
	let phase: GinPhase = 'draw';
	let knockerId: string | null = null;
	let scoringResult: GinRoundScoring | undefined;
	let isRoundComplete = false;
	let isGameOver = false;

	for (const m of moves) {
		if (isRoundComplete) break;

		const activeId = playerIds[currentTurnIndex];
		if (m.playerId !== activeId) continue;

		const activeHand = currentTurnIndex === 0 ? hand0 : hand1;

		if (activeHand.length === 10) {
			// Subphase 1: DRAW
			const topDiscard = discardPile[discardPile.length - 1];
			const topStock = stockPile[0];

			if (topDiscard && cardKey(m.card) === cardKey(topDiscard)) {
				// Drew from discard
				discardPile.pop();
				activeHand.push(topDiscard);
			} else if (topStock) {
				// Drew from stock
				stockPile.shift();
				activeHand.push(topStock);
			}
			phase = 'discard';
		} else if (activeHand.length === 11) {
			// Subphase 2: DISCARD
			const cardIdx = activeHand.findIndex((c) => cardKey(c) === cardKey(m.card));
			if (cardIdx >= 0) {
				// Check for Big Gin before removing discard:
				const prePartition = findOptimalMelds(activeHand);
				const wasBigGin = prePartition.deadwoodPoints === 0;

				const [discarded] = activeHand.splice(cardIdx, 1);
				discardPile.push(discarded);

				// Evaluate remaining 10 cards for Knock:
				const postPartition = findOptimalMelds(activeHand);
				if (postPartition.deadwoodPoints <= 10) {
					// Player knocks!
					knockerId = activeId;
					const defenderIndex = 1 - currentTurnIndex;
					const defenderId = playerIds[defenderIndex];
					const defenderHand = defenderIndex === 0 ? hand0 : hand1;

					scoringResult = evaluateGinRound({
						knockerId,
						defenderId,
						knockerHand: activeHand,
						defenderHand,
						isBigGin: wasBigGin
					});

					cumulativeScores[scoringResult.winnerId] += scoringResult.pointsWon;
					isRoundComplete = true;
					if (
						cumulativeScores[player0Id] >= GIN_TARGET_SCORE ||
						cumulativeScores[player1Id] >= GIN_TARGET_SCORE
					) {
						isGameOver = true;
					}
					phase = 'roundEnd';
					break;
				} else {
					// Did not knock. Check if stock exhausted (2 cards left)
					if (stockPile.length <= 2) {
						// Round ends in draw
						isRoundComplete = true;
						phase = 'roundEnd';
						break;
					}

					// Pass turn to other player
					currentTurnIndex = 1 - currentTurnIndex;
					phase = 'draw';
				}
			}
		}
	}

	return {
		phase,
		dealerIndex,
		nonDealerIndex,
		player0Id,
		player1Id,
		currentTurnIndex,
		hand0,
		hand1,
		discardPile,
		stockPile,
		knockerId,
		isRoundComplete,
		isGameOver,
		cumulativeScores,
		scoringResult
	};
}

export function deriveGinRummyState(params: DeriveParams): DerivedState {
	const engine = computeGinEngineState(params);
	const myIndex = params.playerIds.indexOf(params.myId);
	const myRemainingHand = myIndex === 0 ? engine.hand0 : engine.hand1;

	const isMyTurn = !engine.isRoundComplete && engine.currentTurnIndex === myIndex;

	let playableCards: Card[] = [];
	if (isMyTurn) {
		if (engine.phase === 'draw') {
			const topDiscard = engine.discardPile[engine.discardPile.length - 1];
			const topStock = engine.stockPile[0];
			if (topDiscard) playableCards.push(topDiscard);
			if (topStock) playableCards.push(topStock);
		} else if (engine.phase === 'discard') {
			playableCards = [...myRemainingHand];
		}
	}

	const myPartition = findOptimalMelds(myRemainingHand);
	const canKnock = myRemainingHand.length === 10 && myPartition.deadwoodPoints <= 10;
	const isGin = myRemainingHand.length === 10 && myPartition.deadwoodPoints === 0;
	const isBigGin = myRemainingHand.length === 11 && myPartition.deadwoodPoints === 0;

	const topDiscard = engine.discardPile[engine.discardPile.length - 1] ?? null;

	const uiState: GinUiState = {
		phase: engine.phase,
		topDiscard,
		discardPile: engine.discardPile,
		stockCount: engine.stockPile.length,
		turnPlayerId: params.playerIds[engine.currentTurnIndex],
		knockerId: engine.knockerId,
		myMelds: myPartition.melds,
		myDeadwood: myPartition.deadwood,
		myDeadwoodPoints: myPartition.deadwoodPoints,
		canKnock,
		isGin,
		isBigGin,
		scoringResult: engine.scoringResult
	};

	const allPlayerStats: PlayerStats[] = params.playerIds.map((pId) => ({
		playerId: pId,
		tricksTaken: 0,
		currentScore: engine.cumulativeScores[pId] ?? 0
	}));

	const roundScores: ScoreEntry[] | null = engine.isRoundComplete
		? params.playerIds.map((pId) => ({
				playerId: pId,
				points: engine.cumulativeScores[pId] ?? 0
		  }))
		: null;

	let handType = 'Gin Rummy';
	if (engine.phase === 'draw') {
		handType = `Draw (Deadwood: ${myPartition.deadwoodPoints})`;
	} else if (engine.phase === 'discard') {
		handType = `Discard 1 card (Deadwood: ${myPartition.deadwoodPoints})`;
	} else if (engine.phase === 'roundEnd') {
		handType = engine.scoringResult ? engine.scoringResult.description : 'Round Drawn';
	}

	const trickPlays: TrickPlay[] = topDiscard ? [{ playerId: 'discard', card: topDiscard }] : [];

	return {
		handType,
		myRemainingHand,
		trickPlays,
		lastCompleteTrick: [],
		lastTrickWinnerId: engine.scoringResult ? engine.scoringResult.winnerId : null,
		currentTurnIndex: engine.currentTurnIndex,
		isMyTurn,
		playableCards,
		isRoundComplete: engine.isRoundComplete,
		roundScores,
		isGameOver: engine.isGameOver,
		allPlayerStats,
		gameSpecific: uiState
	};
}
