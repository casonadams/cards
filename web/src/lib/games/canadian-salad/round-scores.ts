import { buildTrickResults } from '$lib/platform/stores/game-store-helpers';
import { scoreHand } from './scoring.ts';
import type { Move, TrickPlay } from '$lib/platform/engine/index';
import type { ScoreEntry } from '$lib/platform/types/index';
import type { HandType } from './types.ts';
import type { PlayerTricks } from './scoring.ts';

export interface RoundScoreParams {
	readonly moves: readonly Move[];
	readonly playerCount: number;
	readonly playerIds: readonly string[];
	readonly handType: HandType;
}

function buildPlayerTricks(
	playerIds: readonly string[],
	trickWinners: { winnerId: string; plays: TrickPlay[] }[]
): PlayerTricks[] {
	const lastWinnerId = trickWinners.at(-1)?.winnerId ?? null;
	return playerIds.map((id) => ({
		playerId: id,
		tricks: trickWinners.filter((t) => t.winnerId === id).map((t) => t.plays),
		isLastTrickWinner: id === lastWinnerId
	}));
}

export function computeRoundScores(params: RoundScoreParams): readonly ScoreEntry[] {
	const { moves, playerCount, playerIds, handType } = params;
	const trickWinners = buildTrickResults({ moves, playerCount, playerIds });
	return scoreHand(handType, buildPlayerTricks(playerIds, trickWinners));
}
