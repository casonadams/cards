import { EXACT_BID_BONUS, type PlayerBid } from './types.ts';
import type { ScoreEntry } from '$lib/platform/types/index';

export function scoreRound(
	bids: readonly PlayerBid[],
	tricksTaken: ReadonlyMap<string, number>
): readonly ScoreEntry[] {
	return bids.map((b) => {
		const taken = tricksTaken.get(b.playerId) ?? 0;
		const made = taken === b.bid;
		return { playerId: b.playerId, points: made ? EXACT_BID_BONUS + b.bid : 0 };
	});
}
