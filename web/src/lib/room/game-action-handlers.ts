import type { GameDocument } from '$lib/platform/engine/index';
import type { GameRuntime, Card } from '$lib/platform/types/index';
import type { DerivedGameState } from '$lib/platform/stores/game-store';
import type { RoundScore } from '$lib/platform/stores/room-store';
import type { RoomActions } from '$lib/platform/stores/room-store';
import { buildRoundResult } from './room-helpers';
import { handleOhWellBid } from './oh-well-helpers';

export interface CardActionParams {
	readonly gameDoc: GameDocument | null;
	readonly playerId: string | undefined;
	readonly actions: RoomActions;
}

export interface DocActionParams {
	readonly gameDoc: GameDocument | null;
	readonly actions: RoomActions;
}

export async function handlePlayCard(params: CardActionParams, card: Card): Promise<void> {
	if (!params.gameDoc || !params.playerId) return;
	await params.actions.playCard({ gameDoc: params.gameDoc, playerId: params.playerId, card });
}

export async function handleOhWellBidAction(params: CardActionParams, bid: number): Promise<void> {
	if (!params.gameDoc || !params.playerId) return;
	await params.actions.updateGameState(
		handleOhWellBid({ doc: params.gameDoc, playerId: params.playerId, bid })
	);
}

export interface AllRoundsParams {
	readonly gameDoc: GameDocument | null;
	readonly gs: DerivedGameState | null;
	readonly runtime: GameRuntime | null;
}

function hasGameEndScores(gs: DerivedGameState | null): gs is DerivedGameState {
	return Boolean(gs?.isGameOver && gs.roundScores);
}

function getPastRounds(doc: GameDocument | null): readonly RoundScore[] {
	return doc?.roundScores ?? [];
}

export function computeAllRounds(params: AllRoundsParams): readonly RoundScore[] {
	const past = getPastRounds(params.gameDoc);
	if (!hasGameEndScores(params.gs)) return past;
	return [
		...past,
		buildRoundResult({ runtime: params.runtime!, doc: params.gameDoc!, gs: params.gs })
	];
}
