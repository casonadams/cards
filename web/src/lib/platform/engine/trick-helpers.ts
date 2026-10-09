import type { Move } from './game-sync.ts';
import type { TrickPlay } from './trick.ts';

/**
 * Extracts currently active, in-progress trick plays from a moves array.
 */
export function extractCurrentTrickPlays(
	moves: readonly Move[],
	playerCount: number
): TrickPlay[] {
	if (playerCount <= 0) return [];
	const trickStart = moves.length - (moves.length % playerCount);
	return moves.slice(trickStart).map((m) => ({ playerId: m.playerId, card: m.card }));
}

/**
 * Extracts the plays from the most recently completed trick, or empty array if none.
 */
export function extractLastCompleteTrick(
	moves: readonly Move[],
	playerCount: number
): TrickPlay[] {
	if (playerCount <= 0) return [];
	const trickStart = moves.length - (moves.length % playerCount);
	if (trickStart < playerCount) return [];
	return moves
		.slice(trickStart - playerCount, trickStart)
		.map((m) => ({ playerId: m.playerId, card: m.card }));
}

export interface TrickLeaderParams {
	readonly moves: readonly Move[];
	readonly playerCount: number;
	readonly playerIds: readonly string[];
	readonly dealerIndex: number;
	readonly resolveWinner: (plays: TrickPlay[]) => { winnerId: string };
}

/**
 * Computes the 0-based player index of the player who leads the current trick.
 */
export function computeTrickLeader(params: TrickLeaderParams): number {
	const { moves, playerCount, playerIds, dealerIndex, resolveWinner } = params;
	if (moves.length === 0 || playerCount <= 0) return (dealerIndex + 1) % Math.max(1, playerCount);
	const lastEnd = moves.length - (moves.length % playerCount);
	if (lastEnd === 0) return (dealerIndex + 1) % playerCount;
	const lastTrick = moves.slice(lastEnd - playerCount, lastEnd);
	const plays: TrickPlay[] = lastTrick.map((m) => ({ playerId: m.playerId, card: m.card }));
	const winnerId = resolveWinner(plays).winnerId;
	const winnerIdx = playerIds.indexOf(winnerId);
	return winnerIdx >= 0 ? winnerIdx : (dealerIndex + 1) % playerCount;
}

/**
 * Computes the 0-based player index of the player whose turn it is to play.
 */
export function computeCurrentTurnIndex(
	movesCount: number,
	playerCount: number,
	leaderIndex: number
): number {
	if (playerCount <= 0) return 0;
	return (leaderIndex + (movesCount % playerCount)) % playerCount;
}
