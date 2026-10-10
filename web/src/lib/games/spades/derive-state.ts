import { dealSpades, removePlayedCards } from './deal.ts';
import { getPlayableSpadesCards, resolveSpadesTrick, isSpadesBroken } from './trick.ts';
import { calculateSpadesRoundScores, getSpadesTeams } from './scoring.ts';
import { evaluateSpadesHand } from './ai.ts';
import {
	extractCurrentTrickPlays,
	extractLastCompleteTrick,
	computeTrickLeader,
	computeCurrentTurnIndex
} from '$lib/platform/engine/trick-helpers';
import type { DeriveParams, DerivedState, PlayerStats } from '$lib/platform/types/game-runtime';
import type { Card, TrickPlay } from '$lib/platform/types/card';
import type { SpadesGameMode, SpadesPlayerBid, SpadesRoundState } from './types.ts';
import { SPADES_TARGET_SCORE } from './types.ts';

export function deriveSpadesState(params: DeriveParams): DerivedState {
	const { moves, seed, currentRound, playerCount, playerIds, myId, dealerIndex, gameSpecific } =
		params;
	const myIndex = playerIds.indexOf(myId);

	const deal = dealSpades(playerCount, seed + currentRound);
	const cardsPerPlayer = deal.hands[0]?.length ?? (playerCount === 6 ? 17 : 13);
	const isRoundComplete = moves.length >= cardsPerPlayer * playerCount;

	const rs = gameSpecific as SpadesRoundState | undefined;
	const mode: SpadesGameMode = rs?.mode ?? (playerCount === 6 ? '6p_teams' : '4p_teams');

	// Resolve bids: if bids provided in gameSpecific use them; otherwise if moves exist, synthesize
	const providedBids: SpadesPlayerBid[] = rs?.bids ? [...rs.bids] : [];
	const isBiddingPhase = moves.length === 0 && providedBids.length < playerCount;

	let activeBids: readonly SpadesPlayerBid[] = providedBids;
	if (activeBids.length < playerCount && moves.length > 0) {
		// Synthesize bids from hands for missing players
		const syntheticBids: SpadesPlayerBid[] = [...providedBids];
		for (let i = 0; i < playerCount; i++) {
			const pid = playerIds[i];
			if (!syntheticBids.some((b) => b.playerId === pid)) {
				const hand = deal.hands[i] ?? [];
				const evalRes = evaluateSpadesHand(hand);
				syntheticBids.push({
					playerId: pid,
					bidType: evalRes.canNil ? 'nil' : 'regular',
					amount: evalRes.canNil ? 0 : evalRes.recommendedBid
				});
			}
		}
		activeBids = syntheticBids;
	}

	const myInitialHand = deal.hands[myIndex] ?? [];
	const myPlayedCards = moves.filter((m) => m.playerId === myId).map((m) => m.card);
	const myRemainingHand = removePlayedCards(myInitialHand, myPlayedCards);

	const trickPlays = extractCurrentTrickPlays(moves, playerCount);
	const lastCompleteTrick = extractLastCompleteTrick(moves, playerCount);
	const lastTrickWinnerId =
		lastCompleteTrick.length > 0 ? resolveSpadesTrick(lastCompleteTrick).winnerId : null;

	// Calculate tricks taken so far
	const tricksTaken: Record<string, number> = {};
	for (const id of playerIds) {
		tricksTaken[id] = 0;
	}
	const completedTricks = Math.floor(moves.length / playerCount);
	for (let t = 0; t < completedTricks; t++) {
		const trickMoves = moves.slice(t * playerCount, (t + 1) * playerCount);
		const winner = resolveSpadesTrick(trickMoves as readonly TrickPlay[]).winnerId;
		tricksTaken[winner] = (tricksTaken[winner] ?? 0) + 1;
	}

	let currentTurnIndex: number;
	let isMyTurn: boolean;
	let playableCards: readonly Card[];

	if (isBiddingPhase) {
		const bidderIdx =
			rs?.currentBidder !== undefined && rs.currentBidder >= 0
				? rs.currentBidder
				: (dealerIndex + 1 + providedBids.length) % playerCount;
		currentTurnIndex = bidderIdx;
		isMyTurn = currentTurnIndex === myIndex;
		playableCards = [];
	} else {
		const leaderIdx = computeTrickLeader({
			moves,
			playerCount,
			playerIds,
			dealerIndex,
			resolveWinner: resolveSpadesTrick
		});
		currentTurnIndex = computeCurrentTurnIndex(moves.length, playerCount, leaderIdx);
		isMyTurn = !isRoundComplete && currentTurnIndex === myIndex;
		playableCards = isMyTurn
			? getPlayableSpadesCards({
					hand: myRemainingHand,
					moves,
					trickPlays,
					playerCount
				})
			: [];
	}

	const scoringResult = calculateSpadesRoundScores({
		playerIds,
		bids: activeBids,
		tricksTaken,
		mode,
		previousBags: rs?.bags
	});

	// Cumulative scores
	const previousCumulative: Record<string, number> = rs?.cumulativeScores ?? {};
	const cumulativeScores: Record<string, number> = {};
	const teams = getSpadesTeams(playerIds, mode);

	for (const team of teams) {
		const prev = previousCumulative[team.teamId] ?? 0;
		const thisRound = isRoundComplete ? (scoringResult.teamPoints[team.teamId] ?? 0) : 0;
		cumulativeScores[team.teamId] = prev + thisRound;
	}

	const isGameOver =
		isRoundComplete &&
		Object.values(cumulativeScores).some((score) => score >= SPADES_TARGET_SCORE || score <= -200);

	const allPlayerStats: PlayerStats[] = playerIds.map((id) => {
		const team = teams.find((t) => t.playerIds.includes(id));
		const currentScore = team ? cumulativeScores[team.teamId] ?? 0 : 0;
		return {
			playerId: id,
			tricksTaken: tricksTaken[id] ?? 0,
			currentScore
		};
	});

	const roundScores = isRoundComplete ? scoringResult.roundScores : null;

	const updatedState: SpadesRoundState = {
		mode,
		phase: isRoundComplete ? 'roundEnd' : isBiddingPhase ? 'bidding' : 'playing',
		bids: activeBids,
		currentBidder: isBiddingPhase ? currentTurnIndex : -1,
		spadesBroken: isSpadesBroken(moves, playerCount),
		tricksTaken,
		bags: isRoundComplete ? scoringResult.newBags : (rs?.bags ?? {}),
		cumulativeScores
	};

	return {
		handType: `Spades (${mode === '4p_solo' ? 'Solo' : 'Teams'})`,
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
