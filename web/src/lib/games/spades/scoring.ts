import type { ScoreEntry } from '$lib/platform/types/game';
import type { SpadesGameMode, SpadesPlayerBid } from './types.ts';

export interface SpadesTeamConfig {
	readonly teamId: string;
	readonly playerIds: readonly string[];
}

export function getSpadesTeams(
	playerIds: readonly string[],
	mode: SpadesGameMode
): readonly SpadesTeamConfig[] {
	if (mode === '4p_solo') {
		return playerIds.map((id) => ({
			teamId: id,
			playerIds: [id]
		}));
	}

	if (mode === '6p_teams') {
		return [
			{ teamId: 'team1', playerIds: [playerIds[0], playerIds[2], playerIds[4]] },
			{ teamId: 'team2', playerIds: [playerIds[1], playerIds[3], playerIds[5]] }
		];
	}

	// Default 4p_teams (2v2)
	return [
		{ teamId: 'team1', playerIds: [playerIds[0], playerIds[2]] },
		{ teamId: 'team2', playerIds: [playerIds[1], playerIds[3]] }
	];
}

export interface CalculateSpadesRoundScoresParams {
	readonly playerIds: readonly string[];
	readonly bids: readonly SpadesPlayerBid[];
	readonly tricksTaken: Record<string, number>;
	readonly mode: SpadesGameMode;
	readonly previousBags?: Record<string, number>;
}

export interface SpadesRoundScoringResult {
	readonly roundScores: readonly ScoreEntry[];
	readonly teamPoints: Record<string, number>;
	readonly newBags: Record<string, number>;
}

export function calculateSpadesRoundScores(
	params: CalculateSpadesRoundScoresParams
): SpadesRoundScoringResult {
	const { playerIds, bids, tricksTaken, mode, previousBags = {} } = params;
	const teams = getSpadesTeams(playerIds, mode);

	const bidMap = new Map<string, SpadesPlayerBid>();
	for (const b of bids) {
		bidMap.set(b.playerId, b);
	}

	const teamPoints: Record<string, number> = {};
	const newBags: Record<string, number> = {};

	for (const team of teams) {
		let contract = 0;
		let regularTricks = 0;
		let teamRoundScore = 0;
		let currentBags = previousBags[team.teamId] ?? 0;

		const nilBidders: SpadesPlayerBid[] = [];

		for (const pid of team.playerIds) {
			const bid = bidMap.get(pid);
			const taken = tricksTaken[pid] ?? 0;

			if (!bid || bid.bidType === 'regular') {
				contract += bid ? bid.amount : 0;
				regularTricks += taken;
			} else {
				nilBidders.push(bid);
			}
		}

		// Contract calculation
		if (regularTricks >= contract) {
			const base = contract * 10;
			const bags = regularTricks - contract;
			teamRoundScore += base + bags;
			currentBags += bags;
		} else {
			// Set: penalty
			teamRoundScore -= contract * 10;
		}

		// Nil & Blind Nil evaluation
		for (const nilBid of nilBidders) {
			const taken = tricksTaken[nilBid.playerId] ?? 0;
			const isBlind = nilBid.bidType === 'blind_nil';
			const bonus = isBlind ? 200 : 100;

			if (taken === 0) {
				teamRoundScore += bonus;
			} else {
				teamRoundScore -= bonus;
				// Tricks taken on failed nil count as bags!
				currentBags += taken;
			}
		}

		// 10-bag penalty evaluation (-100 points per 10 bags)
		while (currentBags >= 10) {
			teamRoundScore -= 100;
			currentBags -= 10;
		}

		teamPoints[team.teamId] = teamRoundScore;
		newBags[team.teamId] = currentBags;
	}

	// Build ScoreEntry array for each player
	const roundScores: ScoreEntry[] = playerIds.map((pid) => {
		const team = teams.find((t) => t.playerIds.includes(pid));
		return {
			playerId: pid,
			points: team ? teamPoints[team.teamId] ?? 0 : 0
		};
	});

	return {
		roundScores,
		teamPoints,
		newBags
	};
}
