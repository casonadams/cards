import { dealHearts } from './deal.ts';
import {
	findTwoOfClubsHolder,
	getPlayableHeartsCards,
	resolveHeartsTrick
} from './trick.ts';
import { calculateHeartsRoundScores, isHeartsGameOver } from './scoring.ts';
import {
	extractCurrentTrickPlays,
	extractLastCompleteTrick,
	computeCurrentTurnIndex
} from '$lib/platform/engine/trick-helpers';
import type { DeriveParams, DerivedState, PlayerStats } from '$lib/platform/types/game-runtime';
import type { Card, Move, TrickPlay } from '$lib/platform/types/card';
import type { HeartsRoundState } from './types.ts';

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

	// Winner of the most recently completed trick leads
	const lastEnd = completedTricks * playerCount;
	const lastTrickMoves = moves.slice(lastEnd - playerCount, lastEnd);
	const plays: TrickPlay[] = lastTrickMoves.map((m) => ({ playerId: m.playerId, card: m.card }));
	const { winnerId } = resolveHeartsTrick(plays);
	const winnerIdx = playerIds.indexOf(winnerId);
	return winnerIdx >= 0 ? winnerIdx : 0;
}

export function deriveHeartsState(params: DeriveParams): DerivedState {
	const { moves, seed, currentRound, playerCount, playerIds, myId, gameSpecific } = params;
	const myIndex = playerIds.indexOf(myId);

	const deal = dealHearts(playerCount, seed + currentRound);
	const myInitialHand = deal.hands[myIndex] ?? [];
	const myPlayedCards = moves.filter((m) => m.playerId === myId).map((m) => m.card);
	const myRemainingHand = myInitialHand.filter(
		(c) => !myPlayedCards.some((p) => p.suit === c.suit && p.rank === c.rank)
	);

	const cardsPerPlayer = deal.hands[0]?.length ?? 13;
	const isRoundComplete = moves.length >= cardsPerPlayer * playerCount;

	const leaderIdx = computeHeartsTrickLeader(moves, playerCount, playerIds, deal.hands);
	const currentTurnIndex = computeCurrentTurnIndex(moves.length, playerCount, leaderIdx);
	const isMyTurn = !isRoundComplete && currentTurnIndex === myIndex;

	const trickPlays = extractCurrentTrickPlays(moves, playerCount);
	const lastCompleteTrick = extractLastCompleteTrick(moves, playerCount);
	const lastTrickWinnerId =
		lastCompleteTrick.length > 0 ? resolveHeartsTrick(lastCompleteTrick).winnerId : null;

	const playableCards = isMyTurn
		? getPlayableHeartsCards({
				hand: myRemainingHand,
				moves,
				trickPlays,
				playerCount
			})
		: [];

	const scoringResult = calculateHeartsRoundScores(moves, playerCount, playerIds);

	// Cumulative scores
	const previousCumulative: Record<string, number> =
		(gameSpecific as HeartsRoundState)?.cumulativeScores ?? {};
	const cumulativeScores: Record<string, number> = {};

	for (const id of playerIds) {
		const prev = previousCumulative[id] ?? 0;
		const thisRound = isRoundComplete
			? (scoringResult.roundScores.find((s) => s.playerId === id)?.points ?? 0)
			: (scoringResult.pointsTaken[id] ?? 0);
		cumulativeScores[id] = prev + thisRound;
	}

	const isGameOver = isRoundComplete && isHeartsGameOver(cumulativeScores);

	const allPlayerStats: PlayerStats[] = playerIds.map((id) => ({
		playerId: id,
		tricksTaken: scoringResult.tricksTaken[id] ?? 0,
		currentScore: cumulativeScores[id] ?? 0
	}));

	const roundScores = isRoundComplete ? scoringResult.roundScores : null;

	const updatedState: HeartsRoundState = {
		phase: isRoundComplete ? 'roundEnd' : 'playing',
		heartsBroken: moves.some((m) => m.card.suit === 'hearts'),
		tricksTaken: scoringResult.tricksTaken,
		pointsTaken: scoringResult.pointsTaken,
		cumulativeScores
	};

	return {
		handType: 'Hearts',
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
