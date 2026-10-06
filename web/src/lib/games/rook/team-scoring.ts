import { getTeamForPlayer } from './ui-state.ts';
import type { PlayerStats } from '$lib/platform/types/game-runtime';
import type { Partnership } from './types.ts';

export interface TeamCapturedParams {
	readonly stats: readonly PlayerStats[];
	readonly partnerships: Partnership;
	readonly nestPoints: number;
	readonly lastTrickWinnerId: string | null;
}

function sumTeamScores(params: TeamCapturedParams): { team1: number; team2: number } {
	let team1 = 0;
	let team2 = 0;
	for (const s of params.stats) {
		if (getTeamForPlayer(params.partnerships, s.playerId) === 1) team1 += s.currentScore;
		else team2 += s.currentScore;
	}
	return { team1, team2 };
}

function nestBonusForTeam(params: TeamCapturedParams, teamNum: 1 | 2): number {
	if (!params.lastTrickWinnerId) return 0;
	return getTeamForPlayer(params.partnerships, params.lastTrickWinnerId) === teamNum
		? params.nestPoints
		: 0;
}

function addNestPoints(
	teams: { team1: number; team2: number },
	params: TeamCapturedParams
): { team1Points: number; team2Points: number } {
	return {
		team1Points: teams.team1 + nestBonusForTeam(params, 1),
		team2Points: teams.team2 + nestBonusForTeam(params, 2)
	};
}

export function computeTeamCaptured(params: TeamCapturedParams): {
	team1Points: number;
	team2Points: number;
} {
	const teams = sumTeamScores(params);
	return addNestPoints(teams, params);
}
