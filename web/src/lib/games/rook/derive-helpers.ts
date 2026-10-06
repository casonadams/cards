import { dealRook, removeCards } from './deal.ts';
import { cardToRook } from './card-adapter.ts';
import { resolveRookTrick } from './trick.ts';
import { sumPoints } from './scoring.ts';
import type { DeriveParams, PlayerStats } from '$lib/platform/types/game-runtime';
import type { Card } from '$lib/platform/types/index';
import type { RookCard, RookColor } from './types.ts';

export function getMyRookHand(params: DeriveParams, myIndex: number): readonly RookCard[] {
	const deal = dealRook(params.playerCount, params.seed + params.currentRound);
	const fullHand = deal.hands[myIndex] ?? [];
	const played = params.moves
		.filter((m) => m.playerId === params.myId)
		.map((m) => cardToRook(m.card));
	return removeCards(fullHand, played);
}

export function computeLeader(params: DeriveParams, trump: RookColor): number {
	const { moves, playerCount, playerIds, dealerIndex } = params;
	if (moves.length === 0) return (dealerIndex + 1) % playerCount;
	const lastEnd = moves.length - (moves.length % playerCount);
	if (lastEnd === 0) return (dealerIndex + 1) % playerCount;
	const lastTrick = moves.slice(lastEnd - playerCount, lastEnd);
	const rookPlays = lastTrick.map((m) => ({ playerId: m.playerId, card: cardToRook(m.card) }));
	return playerIds.indexOf(resolveRookTrick(rookPlays, trump).winnerId);
}

function initTrickMap(playerIds: readonly string[]): Map<string, RookCard[]> {
	const map = new Map<string, RookCard[]>();
	for (const id of playerIds) map.set(id, []);
	return map;
}

interface TrickInput {
	readonly map: Map<string, RookCard[]>;
	readonly chunk: readonly { playerId: string; card: Card }[];
}

function processTrick(input: TrickInput, trump: RookColor): void {
	const { map, chunk } = input;
	const plays = chunk.map((m) => ({ playerId: m.playerId, card: cardToRook(m.card) }));
	const winner = resolveRookTrick(plays, trump).winnerId;
	for (const p of plays) map.get(winner)!.push(p.card);
}

function collectTrickCards(params: DeriveParams, trump: RookColor): Map<string, RookCard[]> {
	const map = initTrickMap(params.playerIds);
	for (let i = 0; i < params.moves.length; i += params.playerCount) {
		const chunk = params.moves.slice(i, i + params.playerCount);
		if (chunk.length < params.playerCount) break;
		processTrick({ map, chunk }, trump);
	}
	return map;
}

interface StatsContext {
	readonly trickCards: Map<string, RookCard[]>;
	readonly playerCount: number;
}

function statsForPlayer(id: string, ctx: StatsContext): PlayerStats {
	const cards = ctx.trickCards.get(id) ?? [];
	return {
		playerId: id,
		tricksTaken: Math.floor(cards.length / ctx.playerCount),
		currentScore: sumPoints(cards)
	};
}

export function computePlayerStats(params: DeriveParams, trump: RookColor): readonly PlayerStats[] {
	const ctx: StatsContext = {
		trickCards: collectTrickCards(params, trump),
		playerCount: params.playerCount
	};
	return params.playerIds.map((id) => statsForPlayer(id, ctx));
}

export { computeTeamCaptured, type TeamCapturedParams } from './team-scoring.ts';
