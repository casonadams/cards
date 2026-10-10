export interface ArrangeAlternatingTeamsParams {
	readonly hostId: string;
	readonly allPlayerIds: readonly string[];
	readonly selectedTeammateIds: readonly string[];
}

/**
 * Reorders player IDs so that Team 1 and Team 2 alternate seats around the table:
 * 4 Players: [Team1 Player1, Team2 Player1, Team1 Player2, Team2 Player2]
 * 6 Players: [Team1 Player1, Team2 Player1, Team1 Player2, Team2 Player2, Team1 Player3, Team2 Player3]
 */
export function arrangeAlternatingTeams(params: ArrangeAlternatingTeamsParams): string[] {
	const { hostId, allPlayerIds, selectedTeammateIds } = params;
	const total = allPlayerIds.length;
	const requiredTeammates = total === 6 ? 2 : 1;

	if (selectedTeammateIds.length !== requiredTeammates) {
		return [...allPlayerIds];
	}

	const team1 = [hostId, ...selectedTeammateIds];
	const team2 = allPlayerIds.filter((id) => !team1.includes(id));

	const result: string[] = [];
	const half = Math.floor(total / 2);
	for (let i = 0; i < half; i++) {
		if (team1[i]) result.push(team1[i]);
		if (team2[i]) result.push(team2[i]);
	}

	return result;
}
