import { dealEuchre } from './deal.ts';
import { getPlayableEuchreCards, resolveEuchreTrick } from './trick.ts';
import { calculateEuchreRoundScores } from './scoring.ts';
import {
	extractCurrentTrickPlays,
	extractLastCompleteTrick
} from '$lib/platform/engine/trick-helpers';
import type { DeriveParams, DerivedState, PlayerStats } from '$lib/platform/types/game-runtime';
import type { Card, Suit, TrickPlay } from '$lib/platform/types/card';
import type { EuchreRoundState } from './types.ts';

function computeEuchreTrickLeader(
	moves: readonly { playerId: string; card: Card }[],
	activePlayerIds: readonly string[],
	dealerIndex: number,
	playerIds: readonly string[],
	trumpSuit: Suit
): number {
	const activeCount = activePlayerIds.length;
	if (moves.length === 0) {
		// Eldest hand: left of dealer
		let leadIdx = (dealerIndex + 1) % playerIds.length;
		while (!activePlayerIds.includes(playerIds[leadIdx])) {
			leadIdx = (leadIdx + 1) % playerIds.length;
		}
		return leadIdx;
	}

	const completedTricks = Math.floor(moves.length / activeCount);
	if (completedTricks === 0) {
		let leadIdx = (dealerIndex + 1) % playerIds.length;
		while (!activePlayerIds.includes(playerIds[leadIdx])) {
			leadIdx = (leadIdx + 1) % playerIds.length;
		}
		return leadIdx;
	}

	const lastEnd = completedTricks * activeCount;
	const lastTrickMoves = moves.slice(lastEnd - activeCount, lastEnd);
	const plays: TrickPlay[] = lastTrickMoves.map((m) => ({ playerId: m.playerId, card: m.card }));
	const { winnerId } = resolveEuchreTrick(plays, trumpSuit);
	const winnerIdx = playerIds.indexOf(winnerId);
	return winnerIdx >= 0 ? winnerIdx : 0;
}

export function deriveEuchreState(params: DeriveParams): DerivedState {
	const { moves, seed, currentRound, playerIds, myId, dealerIndex, gameSpecific } = params;
	const myIndex = playerIds.indexOf(myId);

	const deal = dealEuchre(seed + currentRound);
	const rs = gameSpecific as EuchreRoundState | undefined;

	const trumpSuit: Suit = rs?.trumpSuit ?? deal.upcard.suit;
	const goingAlone = rs?.goingAlone ?? false;
	const alonePlayerId = rs?.alonePlayerId ?? null;

	// Calculate partner sitting out if Go Alone declared
	let partnerSittingOutId: string | null = null;
	if (goingAlone && alonePlayerId) {
		const aloneIdx = playerIds.indexOf(alonePlayerId);
		if (aloneIdx >= 0) {
			partnerSittingOutId = playerIds[(aloneIdx + 2) % 4];
		}
	}

	const activePlayerIds = partnerSittingOutId
		? playerIds.filter((id) => id !== partnerSittingOutId)
		: playerIds;
	const activeCount = activePlayerIds.length; // 4 normally, 3 if Go Alone

	const isSittingOut = myId === partnerSittingOutId;
	const isRoundComplete = moves.length >= 5 * activeCount;

	const myInitialHand = deal.hands[myIndex] ?? [];
	const myPlayedCards = moves.filter((m) => m.playerId === myId).map((m) => m.card);
	const myRemainingHand = myInitialHand.filter(
		(c) => !myPlayedCards.some((p) => p.suit === c.suit && p.rank === c.rank)
	);

	const trickPlays = extractCurrentTrickPlays(moves, activeCount);
	const lastCompleteTrick = extractLastCompleteTrick(moves, activeCount);
	const lastTrickWinnerId =
		lastCompleteTrick.length > 0
			? resolveEuchreTrick(lastCompleteTrick, trumpSuit).winnerId
			: null;

	// Calculate trick leader and current turn index
	const leaderIdx = computeEuchreTrickLeader(
		moves,
		activePlayerIds,
		dealerIndex,
		playerIds,
		trumpSuit
	);

	const activeLeaderIdx = activePlayerIds.indexOf(playerIds[leaderIdx]);
	const activeTurnIdx =
		(activeLeaderIdx + (moves.length % activeCount)) % activeCount;
	const currentTurnIndex = isRoundComplete
		? 0
		: playerIds.indexOf(activePlayerIds[activeTurnIdx]);

	const isMyTurn = !isRoundComplete && !isSittingOut && currentTurnIndex === myIndex;

	const playableCards = isMyTurn
		? getPlayableEuchreCards({
				hand: myRemainingHand,
				trickPlays,
				trumpSuit
			})
		: [];

	// Count tricks taken
	const tricksTaken: Record<string, number> = {};
	for (const id of playerIds) {
		tricksTaken[id] = 0;
	}
	const completedTricks = Math.floor(moves.length / activeCount);
	for (let t = 0; t < completedTricks; t++) {
		const trickMoves = moves.slice(t * activeCount, (t + 1) * activeCount);
		const plays: TrickPlay[] = trickMoves.map((m) => ({ playerId: m.playerId, card: m.card }));
		const winner = resolveEuchreTrick(plays, trumpSuit).winnerId;
		tricksTaken[winner] = (tricksTaken[winner] ?? 0) + 1;
	}

	const makerTeam: 'team1' | 'team2' =
		rs?.makerTeam ?? (rs?.makerId ? (playerIds.indexOf(rs.makerId) % 2 === 0 ? 'team1' : 'team2') : 'team1');

	const scoringResult = calculateEuchreRoundScores({
		playerIds,
		tricksTaken,
		makerTeam,
		goingAlone,
		previousCumulative: rs?.cumulativeScores
	});

	const cumulativeScores = isRoundComplete
		? scoringResult.newCumulativeScores
		: rs?.cumulativeScores ?? { team1: 0, team2: 0 };

	const isGameOver = isRoundComplete && scoringResult.isGameOver;

	const allPlayerStats: PlayerStats[] = playerIds.map((id, idx) => {
		const isTeam1 = idx === 0 || idx === 2;
		const currentScore = isTeam1 ? cumulativeScores.team1 : cumulativeScores.team2;
		return {
			playerId: id,
			tricksTaken: tricksTaken[id] ?? 0,
			currentScore
		};
	});

	const roundScores = isRoundComplete ? scoringResult.roundScores : null;

	const updatedState: EuchreRoundState = {
		phase: isRoundComplete ? 'roundEnd' : (rs?.phase ?? 'playing'),
		trumpSuit,
		upcard: deal.upcard,
		makerId: rs?.makerId ?? playerIds[0],
		makerTeam,
		goingAlone,
		alonePlayerId,
		partnerSittingOutId,
		currentCallerIndex: -1,
		tricksTaken,
		teamTricks: scoringResult.teamTricks,
		cumulativeScores
	};

	return {
		handType: `Euchre (Trump: ${trumpSuit})`,
		myRemainingHand: isSittingOut ? [] : myRemainingHand,
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
