import type { Card, Move, TrickPlay } from '$lib/platform/types/card';
import type { DeriveParams, DerivedState, PlayerStats } from '$lib/platform/types/game-runtime';
import type { ScoreEntry } from '$lib/platform/types/game';
import { dealCribbage } from './deal.ts';
import {
	cardPipValue,
	evaluatePeggingPlay,
	scoreCribbageHand
} from './scoring.ts';
import {
	WINNING_SCORE,
	type CribbagePhase,
	type CribbageScoreBreakdown,
	type CribbageUiState
} from './types.ts';

export interface CribbageEngineState {
	readonly phase: CribbagePhase;
	readonly dealerId: string;
	readonly nonDealerId: string;
	readonly dealerIndex: number;
	readonly nonDealerIndex: number;
	readonly starterCard: Card;
	readonly hisHeels: boolean;
	readonly hand0Initial: readonly Card[];
	readonly hand1Initial: readonly Card[];
	readonly hand0Remaining: readonly Card[];
	readonly hand1Remaining: readonly Card[];
	readonly cribCards: readonly Card[];
	readonly currentCountCards: readonly Card[];
	readonly runningTotal: number;
	readonly currentTurnIndex: number;
	readonly isRoundComplete: boolean;
	readonly isGameOver: boolean;
	readonly playerScores: Record<string, number>;
	readonly trickPlays: readonly TrickPlay[];
	readonly lastCompleteTrick: readonly TrickPlay[];
	readonly nonDealerHandScore?: CribbageScoreBreakdown;
	readonly dealerHandScore?: CribbageScoreBreakdown;
	readonly cribScore?: CribbageScoreBreakdown;
}

export function computeCribbageEngineState(params: DeriveParams): CribbageEngineState {
	const { seed, currentRound, dealerIndex, playerIds, moves } = params;
	const deal = dealCribbage(seed, currentRound);

	const dealerId = playerIds[dealerIndex];
	const nonDealerIndex = (dealerIndex + 1) % 2;
	const nonDealerId = playerIds[nonDealerIndex];

	const hand0Initial = [...deal.hands[0]];
	const hand1Initial = [...deal.hands[1]];

	const playerScores: Record<string, number> = {
		[playerIds[0]]: 0,
		[playerIds[1]]: 0
	};

	// 1. Crib Discard phase:
	// Non-dealer discards 2 cards, dealer discards 2 cards.
	const nonDealerDiscards: Card[] = [];
	const dealerDiscards: Card[] = [];
	const peggingMoves: Move[] = [];

	for (const m of moves) {
		if (m.playerId === nonDealerId && nonDealerDiscards.length < 2) {
			nonDealerDiscards.push(m.card);
		} else if (m.playerId === dealerId && dealerDiscards.length < 2) {
			dealerDiscards.push(m.card);
		} else {
			peggingMoves.push(m);
		}
	}

	const cribCards = [...nonDealerDiscards, ...dealerDiscards];
	const discardsDone = nonDealerDiscards.length === 2 && dealerDiscards.length === 2;

	// Hands after discards:
	function removeCards(hand: readonly Card[], toRemove: readonly Card[]): Card[] {
		const remaining = [...hand];
		for (const rem of toRemove) {
			const idx = remaining.findIndex((c) => c.suit === rem.suit && c.rank === rem.rank);
			if (idx >= 0) remaining.splice(idx, 1);
		}
		return remaining;
	}

	const discardsFor0 = playerIds[0] === nonDealerId ? nonDealerDiscards : dealerDiscards;
	const discardsFor1 = playerIds[1] === nonDealerId ? nonDealerDiscards : dealerDiscards;

	const hand0AfterDiscards = removeCards(hand0Initial, discardsFor0);
	const hand1AfterDiscards = removeCards(hand1Initial, discardsFor1);

	if (!discardsDone) {
		const currentTurn = nonDealerDiscards.length < 2 ? nonDealerIndex : dealerIndex;
		return {
			phase: 'cribDiscard',
			dealerId,
			nonDealerId,
			dealerIndex,
			nonDealerIndex,
			starterCard: deal.starterCard,
			hisHeels: false,
			hand0Initial,
			hand1Initial,
			hand0Remaining: hand0AfterDiscards,
			hand1Remaining: hand1AfterDiscards,
			cribCards,
			currentCountCards: [],
			runningTotal: 0,
			currentTurnIndex: currentTurn,
			isRoundComplete: false,
			isGameOver: false,
			playerScores,
			trickPlays: [],
			lastCompleteTrick: []
		};
	}

	// 2. Starter cut & His Heels:
	const starterCard = deal.starterCard;
	let hisHeels = false;
	if (starterCard.rank === 11) {
		hisHeels = true;
		playerScores[dealerId] += 2;
	}

	let isGameOver = (playerScores[dealerId] >= WINNING_SCORE) || (playerScores[nonDealerId] >= WINNING_SCORE);

	// 3. Pegging Phase:
	let runningTotal = 0;
	let currentCountCards: Card[] = [];
	let trickPlays: TrickPlay[] = [];
	let lastCompleteTrick: TrickPlay[] = [];

	const playerPeggingHands: Record<string, Card[]> = {
		[playerIds[0]]: [...hand0AfterDiscards],
		[playerIds[1]]: [...hand1AfterDiscards]
	};

	let currentTurn = nonDealerIndex;

	for (const m of peggingMoves) {
		if (isGameOver) break;

		const hand = playerPeggingHands[m.playerId];
		if (!hand) continue;
		const cardIdx = hand.findIndex((c) => c.suit === m.card.suit && c.rank === m.card.rank);
		if (cardIdx >= 0) {
			hand.splice(cardIdx, 1);
		}

		const evalPlay = evaluatePeggingPlay(currentCountCards, m.card, runningTotal);
		playerScores[m.playerId] += evalPlay.points;
		runningTotal = evalPlay.newTotal;
		currentCountCards.push(m.card);
		trickPlays.push({ playerId: m.playerId, card: m.card });

		if (playerScores[m.playerId] >= WINNING_SCORE) {
			isGameOver = true;
			break;
		}

		const playerIdx = playerIds.indexOf(m.playerId);
		const otherIdx = 1 - playerIdx;
		const otherId = playerIds[otherIdx];

		if (runningTotal === 31) {
			lastCompleteTrick = [...trickPlays];
			trickPlays = [];
			currentCountCards = [];
			runningTotal = 0;
			const otherCards = playerPeggingHands[otherId];
			const currentCards = playerPeggingHands[m.playerId];
			if (otherCards.length > 0) {
				currentTurn = otherIdx;
			} else if (currentCards.length > 0) {
				currentTurn = playerIdx;
			}
		} else {
			const otherCards = playerPeggingHands[otherId];
			const currentCards = playerPeggingHands[m.playerId];
			const canOtherPlay = otherCards.some((c) => cardPipValue(c) <= 31 - runningTotal);
			const canCurrentPlay = currentCards.some((c) => cardPipValue(c) <= 31 - runningTotal);

			if (canOtherPlay) {
				currentTurn = otherIdx;
			} else if (canCurrentPlay) {
				// Current keeps turn (opponent "Go")
				currentTurn = playerIdx;
			} else {
				// Count dead: 1 pt for Go / last card
				playerScores[m.playerId] += 1;
				if (playerScores[m.playerId] >= WINNING_SCORE) {
					isGameOver = true;
					break;
				}
				lastCompleteTrick = [...trickPlays];
				trickPlays = [];
				currentCountCards = [];
				runningTotal = 0;
				if (otherCards.length > 0) {
					currentTurn = otherIdx;
				} else if (currentCards.length > 0) {
					currentTurn = playerIdx;
				}
			}
		}
	}

	const peggingDone =
		playerPeggingHands[playerIds[0]].length === 0 &&
		playerPeggingHands[playerIds[1]].length === 0;

	if (!peggingDone || isGameOver) {
		return {
			phase: isGameOver ? 'roundEnd' : 'pegging',
			dealerId,
			nonDealerId,
			dealerIndex,
			nonDealerIndex,
			starterCard,
			hisHeels,
			hand0Initial,
			hand1Initial,
			hand0Remaining: playerPeggingHands[playerIds[0]],
			hand1Remaining: playerPeggingHands[playerIds[1]],
			cribCards,
			currentCountCards,
			runningTotal,
			currentTurnIndex: currentTurn,
			isRoundComplete: isGameOver,
			isGameOver,
			playerScores,
			trickPlays,
			lastCompleteTrick
		};
	}

	// 4. The Show (Hand & Crib Scoring)
	const nonDealerHandCards = playerIds[0] === nonDealerId ? hand0AfterDiscards : hand1AfterDiscards;
	const dealerHandCards = playerIds[0] === dealerId ? hand0AfterDiscards : hand1AfterDiscards;

	const nonDealerHandScore = scoreCribbageHand(nonDealerHandCards, starterCard, false);
	playerScores[nonDealerId] += nonDealerHandScore.total;
	if (playerScores[nonDealerId] >= WINNING_SCORE) {
		isGameOver = true;
	}

	let dealerHandScore: CribbageScoreBreakdown | undefined;
	let cribScore: CribbageScoreBreakdown | undefined;

	if (!isGameOver) {
		dealerHandScore = scoreCribbageHand(dealerHandCards, starterCard, false);
		playerScores[dealerId] += dealerHandScore.total;
		if (playerScores[dealerId] >= WINNING_SCORE) {
			isGameOver = true;
		}
	}

	if (!isGameOver) {
		cribScore = scoreCribbageHand(cribCards, starterCard, true);
		playerScores[dealerId] += cribScore.total;
		if (playerScores[dealerId] >= WINNING_SCORE) {
			isGameOver = true;
		}
	}

	return {
		phase: 'roundEnd',
		dealerId,
		nonDealerId,
		dealerIndex,
		nonDealerIndex,
		starterCard,
		hisHeels,
		hand0Initial,
		hand1Initial,
		hand0Remaining: [],
		hand1Remaining: [],
		cribCards,
		currentCountCards: [],
		runningTotal: 0,
		currentTurnIndex: nonDealerIndex,
		isRoundComplete: true,
		isGameOver,
		playerScores,
		trickPlays: [],
		lastCompleteTrick,
		nonDealerHandScore,
		dealerHandScore,
		cribScore
	};
}

export function deriveCribbageState(params: DeriveParams): DerivedState {
	const engine = computeCribbageEngineState(params);
	const myIndex = params.playerIds.indexOf(params.myId);
	const myRemainingHand = myIndex === 0 ? engine.hand0Remaining : engine.hand1Remaining;

	const isMyTurn = !engine.isGameOver && !engine.isRoundComplete && engine.currentTurnIndex === myIndex;

	let playableCards: Card[] = [];
	if (isMyTurn) {
		if (engine.phase === 'cribDiscard') {
			playableCards = [...myRemainingHand];
		} else if (engine.phase === 'pegging') {
			playableCards = myRemainingHand.filter(
				(c) => cardPipValue(c) <= 31 - engine.runningTotal
			);
		}
	}

	const allPlayerStats: PlayerStats[] = params.playerIds.map((pId) => ({
		playerId: pId,
		tricksTaken: 0,
		currentScore: engine.playerScores[pId] ?? 0
	}));

	const roundScores: ScoreEntry[] | null = engine.isRoundComplete
		? params.playerIds.map((pId) => ({
				playerId: pId,
				points: engine.playerScores[pId] ?? 0
		  }))
		: null;

	const uiState: CribbageUiState = {
		phase: engine.phase,
		starterCard: engine.phase !== 'cribDiscard' ? engine.starterCard : null,
		hisHeels: engine.hisHeels,
		runningTotal: engine.runningTotal,
		currentCountCards: engine.currentCountCards,
		dealerId: engine.dealerId,
		nonDealerId: engine.nonDealerId,
		cribCount: engine.cribCards.length,
		cribCards: engine.isRoundComplete ? engine.cribCards : undefined,
		playerPegScores: engine.playerScores,
		handBreakdowns: engine.isRoundComplete
			? {
					[engine.nonDealerId]: engine.nonDealerHandScore!,
					[engine.dealerId]: engine.dealerHandScore ?? {
						fifteens: 0,
						pairs: 0,
						runs: 0,
						flush: 0,
						nobs: 0,
						total: 0,
						descriptions: []
					}
			  }
			: undefined,
		cribBreakdown: engine.cribScore
	};

	let handType = 'Cribbage';
	if (engine.phase === 'cribDiscard') {
		handType = 'Discard 2 to Crib';
	} else if (engine.phase === 'pegging') {
		handType = `Pegging (Count: ${engine.runningTotal}/31)`;
	} else if (engine.phase === 'roundEnd') {
		handType = engine.isGameOver ? 'Match Concluded' : 'Round Scored';
	}

	return {
		handType,
		myRemainingHand,
		trickPlays: engine.trickPlays,
		lastCompleteTrick: engine.lastCompleteTrick,
		lastTrickWinnerId: null,
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
