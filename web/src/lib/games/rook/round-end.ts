import { computeRoundScore } from './scoring.ts';
import { getTeamForPlayer } from './ui-state.ts';
import { computePlayerStats, computeTeamCaptured } from './derive-helpers.ts';
import { WINNING_SCORE } from './types.ts';
import type { DeriveParams } from '$lib/platform/types/game-runtime';
import type { ScoreEntry } from '$lib/platform/types/index';
import type { RookRoundState } from './types.ts';

export interface RoundEndResult {
	readonly roundScores: readonly ScoreEntry[];
	readonly isGameOver: boolean;
}

export interface RoundEndInput {
	readonly params: DeriveParams;
	readonly rs: RookRoundState;
	readonly nestPoints: number;
	readonly lastWinnerId: string | null;
}

function determineBiddingTeam(rs: RookRoundState, playerIds: readonly string[]): 1 | 2 {
	if (rs.bidState.highBidder < 0) return 1;
	return getTeamForPlayer(rs.partnerships, playerIds[rs.bidState.highBidder]) as 1 | 2;
}

function checkGameOver(
	rs: RookRoundState,
	result: { team1Delta: number; team2Delta: number }
): boolean {
	return (
		rs.team1Total + result.team1Delta >= WINNING_SCORE ||
		rs.team2Total + result.team2Delta >= WINNING_SCORE
	);
}

interface ScoreContext {
	readonly rs: RookRoundState;
	readonly result: { team1Delta: number; team2Delta: number };
}

function buildRoundScores(playerIds: readonly string[], ctx: ScoreContext): readonly ScoreEntry[] {
	return playerIds.map((id) => ({
		playerId: id,
		points:
			getTeamForPlayer(ctx.rs.partnerships, id) === 1
				? ctx.result.team1Delta
				: ctx.result.team2Delta
	}));
}

export function computeRoundEnd(input: RoundEndInput): RoundEndResult {
	const { params, rs, nestPoints, lastWinnerId } = input;
	const trump = rs.trumpColor ?? 'black';
	const allStats = computePlayerStats(params, trump);
	const captured = computeTeamCaptured({
		stats: allStats,
		partnerships: rs.partnerships,
		nestPoints,
		lastTrickWinnerId: lastWinnerId
	});
	const biddingTeam = determineBiddingTeam(rs, params.playerIds);
	const result = computeRoundScore({ captured, highBid: rs.bidState.highBid, biddingTeam });
	return {
		isGameOver: checkGameOver(rs, result),
		roundScores: buildRoundScores(params.playerIds, { rs, result })
	};
}
