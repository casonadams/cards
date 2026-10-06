import { rookToCard } from './card-adapter.ts';
import { buildRookUiState } from './build-ui-state.ts';
import { getMyRookHand } from './derive-helpers.ts';
import type { DeriveParams, DerivedState } from '$lib/platform/types/game-runtime';
import type { RookRoundState } from './types.ts';

interface TurnContext {
	readonly rs: RookRoundState;
	readonly params: DeriveParams;
	readonly leaderIdx: number;
}

export function getTurnIndex(ctx: TurnContext): number {
	if (ctx.rs.phase === 'playing') {
		return (
			(ctx.leaderIdx + (ctx.params.moves.length % ctx.params.playerCount)) % ctx.params.playerCount
		);
	}
	return ctx.rs.phase === 'bidding' ? ctx.rs.bidState.currentBidder : -1;
}

export function deriveBiddingState(input: {
	readonly params: DeriveParams;
	readonly rs: RookRoundState;
	readonly myIndex: number;
}): DerivedState {
	const { params, rs, myIndex } = input;
	return {
		handType: 'Bidding',
		myRemainingHand: getMyRookHand(params, myIndex).map(rookToCard),
		trickPlays: [],
		lastCompleteTrick: [],
		lastTrickWinnerId: null,
		currentTurnIndex: getTurnIndex({ rs, params, leaderIdx: 0 }),
		isMyTurn: rs.phase === 'bidding' && rs.bidState.currentBidder === myIndex,
		playableCards: [],
		isRoundComplete: false,
		allPlayerStats: [],
		roundScores: null,
		isGameOver: false,
		gameSpecific: buildRookUiState({ rs, params, myIndex })
	};
}
