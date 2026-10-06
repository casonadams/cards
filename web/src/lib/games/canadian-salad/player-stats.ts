import { buildTrickResults } from '$lib/platform/stores/game-store-helpers';
import { computeRoundScores } from './round-scores.ts';
import type { Move } from '$lib/platform/engine/index';
import type { HandType } from './types.ts';

export interface PlayerStats {
	readonly playerId: string;
	readonly tricksTaken: number;
	readonly currentScore: number;
}

interface StatsParams {
	readonly moves: readonly Move[];
	readonly playerCount: number;
	readonly playerIds: readonly string[];
	readonly handType: HandType;
}

export function getAllPlayerStats(params: StatsParams): readonly PlayerStats[] {
	const { moves, playerCount, playerIds, handType } = params;
	const tricks = buildTrickResults({ moves, playerCount, playerIds });
	const scores = computeRoundScores({ moves, playerCount, playerIds, handType });
	return playerIds.map((id) => ({
		playerId: id,
		tricksTaken: tricks.filter((t) => t.winnerId === id).length,
		currentScore: scores.find((s) => s.playerId === id)?.points ?? 0
	}));
}
