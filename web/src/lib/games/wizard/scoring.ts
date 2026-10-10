import type { ScoreEntry } from '$lib/platform/types/game';
import type { WizardPlayerBid } from './types.ts';

export interface WizardScoringParams {
	readonly playerIds: readonly string[];
	readonly bids: readonly WizardPlayerBid[];
	readonly tricksTaken: Record<string, number>;
	readonly previousCumulative?: Record<string, number>;
}

export interface WizardScoringResult {
	readonly roundScores: readonly ScoreEntry[];
	readonly newCumulativeScores: Record<string, number>;
}

export function calculateWizardRoundScores(
	params: WizardScoringParams
): WizardScoringResult {
	const { playerIds, bids, tricksTaken, previousCumulative = {} } = params;

	const bidMap = new Map<string, number>();
	for (const b of bids) {
		bidMap.set(b.playerId, b.bid);
	}

	const roundScores: ScoreEntry[] = [];
	const newCumulativeScores: Record<string, number> = {};

	for (const pid of playerIds) {
		const bid = bidMap.get(pid) ?? 0;
		const won = tricksTaken[pid] ?? 0;

		let points: number;
		if (won === bid) {
			// Exact bid made: +20 + 10/trick
			points = 20 + 10 * bid;
		} else {
			// Missed bid: -10 per trick error
			points = -10 * Math.abs(won - bid);
		}

		roundScores.push({ playerId: pid, points });
		newCumulativeScores[pid] = (previousCumulative[pid] ?? 0) + points;
	}

	return {
		roundScores,
		newCumulativeScores
	};
}
