import type { Move, TrickPlay } from '$lib/platform/types/card';
import type { ScoreEntry } from '$lib/platform/types/game';
import { resolveHeartsTrick } from './trick.ts';
import { HEARTS_TOTAL_PENALTY_POINTS, HEARTS_GAME_OVER_THRESHOLD } from './types.ts';

export interface HeartsScoringResult {
	readonly roundScores: readonly ScoreEntry[];
	readonly shooterId: string | null;
	readonly pointsTaken: Record<string, number>;
	readonly tricksTaken: Record<string, number>;
}

export function calculateHeartsRoundScores(
	moves: readonly Move[],
	playerCount: number,
	playerIds: readonly string[],
	moonOption: 'subtract_shooter' | 'add_opponents' = 'subtract_shooter'
): HeartsScoringResult {
	const pointsTaken: Record<string, number> = {};
	const tricksTaken: Record<string, number> = {};

	for (const id of playerIds) {
		pointsTaken[id] = 0;
		tricksTaken[id] = 0;
	}

	const totalTricks = Math.floor(moves.length / playerCount);

	for (let t = 0; t < totalTricks; t++) {
		const trickMoves = moves.slice(t * playerCount, (t + 1) * playerCount);
		const plays: TrickPlay[] = trickMoves.map((m) => ({ playerId: m.playerId, card: m.card }));
		const { winnerId, points } = resolveHeartsTrick(plays);

		tricksTaken[winnerId] = (tricksTaken[winnerId] ?? 0) + 1;
		pointsTaken[winnerId] = (pointsTaken[winnerId] ?? 0) + points;
	}

	// Check for Shooting the Moon (player took all 26 points)
	let shooterId: string | null = null;
	for (const id of playerIds) {
		if (pointsTaken[id] === HEARTS_TOTAL_PENALTY_POINTS) {
			shooterId = id;
			break;
		}
	}

	const roundScores: ScoreEntry[] = playerIds.map((id) => {
		if (shooterId !== null) {
			if (moonOption === 'subtract_shooter') {
				return {
					playerId: id,
					points: id === shooterId ? -HEARTS_TOTAL_PENALTY_POINTS : 0
				};
			} else {
				return {
					playerId: id,
					points: id === shooterId ? 0 : HEARTS_TOTAL_PENALTY_POINTS
				};
			}
		}
		return {
			playerId: id,
			points: pointsTaken[id] ?? 0
		};
	});

	return {
		roundScores,
		shooterId,
		pointsTaken,
		tricksTaken
	};
}

export function isHeartsGameOver(cumulativeScores: Record<string, number>): boolean {
	return Object.values(cumulativeScores).some((score) => score >= HEARTS_GAME_OVER_THRESHOLD);
}
