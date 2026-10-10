import type { ScoreEntry } from '$lib/platform/types/game';

export interface EuchreScoringParams {
	readonly playerIds: readonly string[];
	readonly tricksTaken: Record<string, number>;
	readonly makerTeam: 'team1' | 'team2';
	readonly goingAlone: boolean;
	readonly previousCumulative?: { team1: number; team2: number };
}

export interface EuchreScoringResult {
	readonly roundScores: readonly ScoreEntry[];
	readonly teamRoundScores: { team1: number; team2: number };
	readonly teamTricks: { team1: number; team2: number };
	readonly newCumulativeScores: { team1: number; team2: number };
	readonly isGameOver: boolean;
}

export function calculateEuchreRoundScores(
	params: EuchreScoringParams
): EuchreScoringResult {
	const {
		playerIds,
		tricksTaken,
		makerTeam,
		goingAlone,
		previousCumulative = { team1: 0, team2: 0 }
	} = params;

	const team1Tricks = (tricksTaken[playerIds[0]] ?? 0) + (tricksTaken[playerIds[2]] ?? 0);
	const team2Tricks = (tricksTaken[playerIds[1]] ?? 0) + (tricksTaken[playerIds[3]] ?? 0);

	const teamTricks = { team1: team1Tricks, team2: team2Tricks };
	const teamRoundScores = { team1: 0, team2: 0 };

	const makerTricks = makerTeam === 'team1' ? team1Tricks : team2Tricks;
	const defendingTeam: 'team1' | 'team2' = makerTeam === 'team1' ? 'team2' : 'team1';

	if (makerTricks >= 3) {
		if (makerTricks === 5) {
			// March!
			teamRoundScores[makerTeam] = goingAlone ? 4 : 2;
		} else {
			// 3 or 4 tricks
			teamRoundScores[makerTeam] = 1;
		}
	} else {
		// Makers euchred! Defenders get 2 points
		teamRoundScores[defendingTeam] = 2;
	}

	const newCumulativeScores = {
		team1: previousCumulative.team1 + teamRoundScores.team1,
		team2: previousCumulative.team2 + teamRoundScores.team2
	};

	const isGameOver = newCumulativeScores.team1 >= 10 || newCumulativeScores.team2 >= 10;

	const roundScores: ScoreEntry[] = playerIds.map((pid, idx) => {
		const isTeam1 = idx === 0 || idx === 2;
		return {
			playerId: pid,
			points: isTeam1 ? teamRoundScores.team1 : teamRoundScores.team2
		};
	});

	return {
		roundScores,
		teamRoundScores,
		teamTricks,
		newCumulativeScores,
		isGameOver
	};
}
