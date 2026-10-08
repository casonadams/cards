import type { PlayerStats } from '$lib/platform/types/index';
import type { OhWellUiState } from '$lib/games/oh-well/ui-state';
import type { RookUiState } from '$lib/games/rook/ui-state';

export interface StatContext {
	readonly gameId: string;
	readonly allPlayerStats: readonly PlayerStats[];
	readonly previousTotals: Record<string, number>;
	readonly ohWellUi: OhWellUiState | null;
	readonly rookUi: RookUiState | null;
}

function statsFor(ctx: StatContext, id: string): PlayerStats {
	return (
		ctx.allPlayerStats.find((s) => s.playerId === id) ?? {
			playerId: id,
			tricksTaken: 0,
			currentScore: 0
		}
	);
}

function prevScore(ctx: StatContext, id: string): number {
	return ctx.previousTotals[id] ?? 0;
}

function ohWellTricks(ctx: StatContext, id: string): number {
	return ctx.ohWellUi?.tricksTaken[id] ?? statsFor(ctx, id).tricksTaken;
}

function ohWellBidStr(ctx: StatContext, id: string): string {
	const b = ctx.ohWellUi?.bids.find((x) => x.playerId === id);
	return b ? `${ohWellTricks(ctx, id)}/${b.bid}` : '...';
}

function ohWellStatLine(ctx: StatContext, id: string, compact = false): string {
	const score = prevScore(ctx, id);
	return compact
		? `${ohWellBidStr(ctx, id)} | ${score}p`
		: `${ohWellBidStr(ctx, id)} | ${score} pts`;
}

function rookStatLine(ctx: StatContext, id: string, compact = false): string {
	const st = statsFor(ctx, id);
	return compact
		? `${st.tricksTaken}t | ${st.currentScore}p`
		: `${st.tricksTaken} tricks | ${st.currentScore} pts`;
}

function defaultStatLine(ctx: StatContext, id: string, compact = false): string {
	const st = statsFor(ctx, id);
	const score = prevScore(ctx, id) + st.currentScore;
	return compact
		? `${st.tricksTaken}t | ${score}p`
		: `${st.tricksTaken} tricks | ${score} pts`;
}

const STAT_LINE_FNS: Record<string, (ctx: StatContext, id: string, compact?: boolean) => string> = {
	'oh-well': ohWellStatLine,
	rook: rookStatLine
};

export function playerStatLine(ctx: StatContext, id: string, compact = false): string {
	return (STAT_LINE_FNS[ctx.gameId] ?? defaultStatLine)(ctx, id, compact);
}

export function myStatLine(ctx: StatContext, id: string): string {
	if (ctx.gameId === 'oh-well') return ohWellBidStr(ctx, id);
	return `${statsFor(ctx, id).tricksTaken}`;
}

function buildTeamMap(rookUi: RookUiState): Map<string, number> {
	const map = new Map<string, number>();
	rookUi.partnerships.team1.forEach((id) => map.set(id, 1));
	rookUi.partnerships.team2.forEach((id) => map.set(id, 2));
	return map;
}

export function teamFor(rookUi: RookUiState | null, id: string): number | null {
	if (!rookUi) return null;
	return buildTeamMap(rookUi).get(id) ?? null;
}
