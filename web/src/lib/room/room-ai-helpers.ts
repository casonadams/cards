import { getAiCurrentId, getAiDelay, buildAiMove } from './room-helpers.ts';
import type { GameDocument } from '$lib/platform/engine/index';
import type { DerivedGameState } from '$lib/platform/stores/game-store';
import type { GameRuntime, Card } from '$lib/platform/types/index';

function hasAiContext(params: {
	isHost: boolean;
	gameDoc: GameDocument | null;
	gs: DerivedGameState | null;
}): boolean {
	return Boolean(params.isHost && params.gameDoc && params.gs);
}

export function shouldRunAi(params: {
	isHost: boolean;
	gameDoc: GameDocument | null;
	gs: DerivedGameState | null;
}): boolean {
	return hasAiContext(params) && !params.gs!.isRoundComplete;
}

interface ScheduleAiParams {
	readonly playerIds: readonly string[];
	readonly gs: DerivedGameState;
	readonly gameDoc: GameDocument;
	readonly runtime: GameRuntime;
	readonly playCard: (a: { gameDoc: GameDocument; playerId: string; card: Card }) => Promise<void>;
}

export function scheduleAiMove(params: ScheduleAiParams): (() => void) | undefined {
	const id = getAiCurrentId(params.playerIds, params.gs);
	if (!id) return;
	const { gameDoc, playerIds, playCard, runtime } = params;
	const t = setTimeout(async () => {
		const m = buildAiMove({ runtime, doc: gameDoc, playerIds, currentId: id });
		if (m) await playCard({ gameDoc, playerId: m.playerId, card: m.card });
	}, getAiDelay(params.gs));
	return () => clearTimeout(t);
}
