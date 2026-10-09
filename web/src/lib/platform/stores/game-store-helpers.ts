import { resolveTrick, computeTrickLeader } from '../engine/index.ts';
import type { Move, TrickPlay } from '../engine/index.ts';

export interface LeaderParams {
	readonly moves: readonly Move[];
	readonly playerCount: number;
	readonly playerIds: readonly string[];
	readonly dealerIndex: number;
}

export function computeLeader(params: LeaderParams): number {
	const { moves, playerCount, playerIds, dealerIndex } = params;
	return computeTrickLeader({ moves, playerCount, playerIds, dealerIndex, resolveWinner: resolveTrick });
}

export interface TrickResultsParams {
	readonly moves: readonly Move[];
	readonly playerCount: number;
	readonly playerIds: readonly string[];
}

export function buildTrickResults(
	params: TrickResultsParams
): { winnerId: string; plays: TrickPlay[] }[] {
	const { moves, playerCount } = params;
	const results: { winnerId: string; plays: TrickPlay[] }[] = [];
	for (let i = 0; i < moves.length; i += playerCount) {
		const chunk = moves.slice(i, i + playerCount);
		const plays: TrickPlay[] = chunk.map((m) => ({ playerId: m.playerId, card: m.card }));
		if (plays.length === playerCount)
			results.push({ winnerId: resolveTrick(plays).winnerId, plays });
	}
	return results;
}
