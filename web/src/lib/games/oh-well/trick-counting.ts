import { resolveOhWellTrick } from './trick.ts';
import type { DeriveParams, PlayerStats } from '$lib/platform/types/game-runtime';
import type { Card, Suit } from '$lib/platform/types/index';
import type { TrickPlay } from '$lib/platform/engine/index';
import type { OhWellRoundState } from './types.ts';

function resolveTrickWinner(
	chunk: readonly { playerId: string; card: Card }[],
	trumpSuit: Suit | null
): string {
	const plays: TrickPlay[] = chunk.map((m) => ({ playerId: m.playerId, card: m.card }));
	return resolveOhWellTrick(plays, trumpSuit).winnerId;
}

function initTrickCounts(playerIds: readonly string[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const id of playerIds) counts.set(id, 0);
	return counts;
}

interface TrickCountInput {
	readonly params: DeriveParams;
	readonly trumpSuit: Suit | null;
}

function incrementWinner(counts: Map<string, number>, winner: string): void {
	counts.set(winner, (counts.get(winner) ?? 0) + 1);
}

function addCompleteTricks(counts: Map<string, number>, input: TrickCountInput): void {
	const { moves, playerCount } = input.params;
	for (let i = 0; i < moves.length; i += playerCount) {
		const chunk = moves.slice(i, i + playerCount);
		if (chunk.length < playerCount) return;
		incrementWinner(counts, resolveTrickWinner(chunk, input.trumpSuit));
	}
}

export function countTricksTaken(
	params: DeriveParams,
	trumpSuit: Suit | null
): Map<string, number> {
	const counts = initTrickCounts(params.playerIds);
	addCompleteTricks(counts, { params, trumpSuit });
	return counts;
}

function computePlayerScore(bid: number, taken: number): number {
	return bid === taken ? 10 + bid : 0;
}

function findBid(rs: OhWellRoundState, id: string): number {
	return rs.bids.find((b) => b.playerId === id)?.bid ?? 0;
}

interface PlayerStatParams {
	readonly id: string;
	readonly rs: OhWellRoundState;
	readonly tricksTaken: Map<string, number>;
}

function computePlayerStat(sp: PlayerStatParams): PlayerStats {
	const taken = sp.tricksTaken.get(sp.id) ?? 0;
	return {
		playerId: sp.id,
		tricksTaken: taken,
		currentScore: computePlayerScore(findBid(sp.rs, sp.id), taken)
	};
}

export interface StatsParams {
	readonly playerIds: readonly string[];
	readonly rs: OhWellRoundState;
	readonly tricksTaken: Map<string, number>;
}

export function buildPlayerStats(sp: StatsParams): readonly PlayerStats[] {
	return sp.playerIds.map((id) =>
		computePlayerStat({ id, rs: sp.rs, tricksTaken: sp.tricksTaken })
	);
}
