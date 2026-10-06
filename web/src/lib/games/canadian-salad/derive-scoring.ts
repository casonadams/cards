import { computeRoundScores } from './round-scores.ts';
import { getAllPlayerStats } from './player-stats.ts';
import type { DeriveParams } from '$lib/platform/types/game-runtime';
import type { HandType } from './types.ts';

export interface DeriveScoringParams {
	readonly params: DeriveParams;
	readonly handType: HandType;
	readonly isRoundComplete: boolean;
}

export function deriveScoring(scoring: DeriveScoringParams) {
	const { moves, playerCount, playerIds } = scoring.params;
	const allPlayerStats = getAllPlayerStats({
		moves,
		playerCount,
		playerIds,
		handType: scoring.handType
	});
	const roundScores = scoring.isRoundComplete
		? computeRoundScores({ moves, playerCount, playerIds, handType: scoring.handType })
		: null;
	return { allPlayerStats, roundScores };
}
