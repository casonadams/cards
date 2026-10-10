import { dealWizard } from './deal.ts';
import { getPlayableWizardCards, resolveWizardTrick } from './trick.ts';
import { calculateWizardRoundScores } from './scoring.ts';
import { evaluateWizardHand } from './ai.ts';
import {
	extractCurrentTrickPlays,
	extractLastCompleteTrick,
	computeTrickLeader,
	computeCurrentTurnIndex
} from '$lib/platform/engine/trick-helpers';
import type { DeriveParams, DerivedState, PlayerStats } from '$lib/platform/types/game-runtime';
import type { Card, TrickPlay } from '$lib/platform/types/card';
import type { WizardPlayerBid, WizardRoundState } from './types.ts';
import { getTotalWizardRounds } from './types.ts';

export function deriveWizardState(params: DeriveParams): DerivedState {
	const { moves, seed, currentRound, playerCount, playerIds, myId, dealerIndex, gameSpecific } =
		params;
	const myIndex = playerIds.indexOf(myId);

	const deal = dealWizard({ playerCount, currentRound, seed: seed + currentRound });
	const rs = gameSpecific as WizardRoundState | undefined;
	const trumpSuit = rs?.trumpSuit !== undefined ? rs.trumpSuit : deal.trumpSuit;

	const cardsPerPlayer = currentRound + 1;
	const totalRounds = getTotalWizardRounds(playerCount);
	const isRoundComplete = moves.length >= cardsPerPlayer * playerCount;

	// Bids handling
	const providedBids: WizardPlayerBid[] = rs?.bids ? [...rs.bids] : [];
	const isBiddingPhase = moves.length === 0 && providedBids.length < playerCount;

	let activeBids: readonly WizardPlayerBid[] = providedBids;
	if (activeBids.length < playerCount && moves.length > 0) {
		const syntheticBids: WizardPlayerBid[] = [...providedBids];
		for (let i = 0; i < playerCount; i++) {
			const pid = playerIds[i];
			if (!syntheticBids.some((b) => b.playerId === pid)) {
				const hand = deal.hands[i] ?? [];
				const bid = evaluateWizardHand(hand, trumpSuit);
				syntheticBids.push({ playerId: pid, bid });
			}
		}
		activeBids = syntheticBids;
	}

	const myInitialHand = deal.hands[myIndex] ?? [];
	const myPlayedCards = moves.filter((m) => m.playerId === myId).map((m) => m.card);

	const myRemainingHand = [...myInitialHand];
	for (const played of myPlayedCards) {
		const idx = myRemainingHand.findIndex((c) => c.suit === played.suit && c.rank === played.rank);
		if (idx >= 0) myRemainingHand.splice(idx, 1);
	}

	const trickPlays = extractCurrentTrickPlays(moves, playerCount);
	const lastCompleteTrick = extractLastCompleteTrick(moves, playerCount);
	const lastTrickWinnerId =
		lastCompleteTrick.length > 0
			? resolveWizardTrick(lastCompleteTrick, trumpSuit).winnerId
			: null;

	// Calculate tricks taken
	const tricksTaken: Record<string, number> = {};
	for (const id of playerIds) {
		tricksTaken[id] = 0;
	}
	const completedTricks = Math.floor(moves.length / playerCount);
	for (let t = 0; t < completedTricks; t++) {
		const trickMoves = moves.slice(t * playerCount, (t + 1) * playerCount);
		const plays: TrickPlay[] = trickMoves.map((m) => ({ playerId: m.playerId, card: m.card }));
		const winner = resolveWizardTrick(plays, trumpSuit).winnerId;
		tricksTaken[winner] = (tricksTaken[winner] ?? 0) + 1;
	}

	let currentTurnIndex: number;
	let isMyTurn: boolean;
	let playableCards: readonly Card[];

	if (isBiddingPhase) {
		currentTurnIndex = (dealerIndex + 1 + providedBids.length) % playerCount;
		isMyTurn = currentTurnIndex === myIndex;
		playableCards = [];
	} else {
		const leaderIdx = computeTrickLeader({
			moves,
			playerCount,
			playerIds,
			dealerIndex,
			resolveWinner: (plays) => resolveWizardTrick(plays, trumpSuit)
		});
		currentTurnIndex = computeCurrentTurnIndex(moves.length, playerCount, leaderIdx);
		isMyTurn = !isRoundComplete && currentTurnIndex === myIndex;
		playableCards = isMyTurn
			? getPlayableWizardCards({
					hand: myRemainingHand,
					trickPlays
				})
			: [];
	}

	const scoringResult = calculateWizardRoundScores({
		playerIds,
		bids: activeBids,
		tricksTaken,
		previousCumulative: rs?.cumulativeScores
	});

	const cumulativeScores = isRoundComplete
		? scoringResult.newCumulativeScores
		: rs?.cumulativeScores ?? {};

	const isGameOver = isRoundComplete && currentRound >= totalRounds - 1;

	const allPlayerStats: PlayerStats[] = playerIds.map((id) => ({
		playerId: id,
		tricksTaken: tricksTaken[id] ?? 0,
		currentScore: cumulativeScores[id] ?? 0
	}));

	const roundScores = isRoundComplete ? scoringResult.roundScores : null;

	const updatedState: WizardRoundState = {
		phase: isRoundComplete ? 'roundEnd' : isBiddingPhase ? 'bidding' : 'playing',
		trumpCard: deal.trumpCard,
		trumpSuit,
		bids: activeBids,
		tricksTaken,
		cumulativeScores
	};

	const trumpLabel = trumpSuit ? `Trump: ${trumpSuit}` : 'No Trump';

	return {
		handType: `Wizard Round ${currentRound + 1} (${trumpLabel})`,
		myRemainingHand,
		trickPlays,
		lastCompleteTrick,
		lastTrickWinnerId,
		currentTurnIndex,
		isMyTurn,
		playableCards,
		isRoundComplete,
		roundScores,
		isGameOver,
		allPlayerStats,
		gameSpecific: updatedState
	};
}
