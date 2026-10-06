import { resolveOhWellTrick } from './trick.ts';
import {
	getState,
	getMyHand,
	computeLeader,
	getTrickPlays,
	getLastTrick,
	getPlayableCards
} from './derive-helpers.ts';
import { countTricksTaken, buildPlayerStats } from './trick-counting.ts';
import {
	buildUiState,
	buildHandLabel,
	computeEndRoundScores,
	isGameOver,
	biddingDefaults
} from './derive-bidding.ts';
import type { EndOfRoundParams } from './derive-bidding.ts';
import type { DeriveParams, DerivedState } from '$lib/platform/types/game-runtime';
import type { OhWellRoundState } from './types.ts';

function derivePlayingFields(params: DeriveParams, rs: OhWellRoundState): Partial<DerivedState> {
	const tricksTaken = countTricksTaken(params, rs.trumpSuit);
	const leaderIdx = computeLeader(params, rs.trumpSuit);
	const currentTurnIndex =
		(leaderIdx + (params.moves.length % params.playerCount)) % params.playerCount;
	const isRoundComplete = params.moves.length >= rs.cardsPerPlayer * params.playerCount;
	const myIndex = params.playerIds.indexOf(params.myId);
	const isMyTurn = !isRoundComplete && currentTurnIndex === myIndex;
	const trickPlays = getTrickPlays(params);
	return {
		trickPlays,
		lastCompleteTrick: getLastTrick(params),
		currentTurnIndex,
		isMyTurn,
		isRoundComplete,
		allPlayerStats: buildPlayerStats({ playerIds: params.playerIds, rs, tricksTaken }),
		playableCards: getPlayableCards({
			hand: getMyHand({ params, myIndex, cardsPerPlayer: rs.cardsPerPlayer }),
			isMyTurn,
			trickPlays
		})
	};
}

function deriveLastTrickWinner(params: DeriveParams, rs: OhWellRoundState): string | null {
	const last = getLastTrick(params);
	return last.length > 0 ? resolveOhWellTrick(last, rs.trumpSuit).winnerId : null;
}

export function deriveOhWellState(params: DeriveParams): DerivedState {
	const rs = getState(params);
	const myIndex = params.playerIds.indexOf(params.myId);
	const myHand = getMyHand({ params, myIndex, cardsPerPlayer: rs.cardsPerPlayer });
	const base =
		rs.phase === 'playing' ? derivePlayingFields(params, rs) : biddingDefaults(rs, myIndex);
	const eor: EndOfRoundParams = { params, rs, isRoundComplete: base.isRoundComplete ?? false };
	return {
		handType: buildHandLabel(rs),
		myRemainingHand: myHand,
		lastTrickWinnerId: deriveLastTrickWinner(params, rs),
		gameSpecific: buildUiState(params, rs),
		...base,
		roundScores: computeEndRoundScores(eor),
		isGameOver: isGameOver(eor)
	} as DerivedState;
}
