import type { GameDocument } from '$lib/platform/engine/index';
import type { GameRuntime } from '$lib/platform/types/index';
import type { DerivedGameState } from '$lib/platform/stores/game-store';
import type { RoomActions } from '$lib/platform/stores/room-store';
import { getAiCurrentId, getAiDelay, buildAiMove, shouldRunAi } from './room-helpers';
import {
	isOhWellBiddingPhase,
	shouldRunOhWellAiBid,
	getCurrentOhWellBidderId,
	computeOhWellAiBid,
	handleOhWellBid
} from './oh-well-helpers';

export interface AiEffectDeps {
	readonly isHost: boolean;
	readonly gameDoc: GameDocument | null;
	readonly gs: DerivedGameState | null;
	readonly playerIds: readonly string[];
	readonly runtime: GameRuntime | null;
	readonly actions: RoomActions;
}

interface TrickTakingDeps extends AiEffectDeps {
	readonly isOhWell: boolean;
}

function shouldSkipTrickTaking(deps: TrickTakingDeps): boolean {
	if (!shouldRunAi({ isHost: deps.isHost, gameDoc: deps.gameDoc, gs: deps.gs })) return true;
	if (deps.isOhWell && deps.gs && isOhWellBiddingPhase(deps.gs)) return true;
	return false;
}

export function setupTrickTakingAi(deps: TrickTakingDeps): (() => void) | undefined {
	if (shouldSkipTrickTaking(deps)) return undefined;
	const id = getAiCurrentId(deps.playerIds, deps.gs!);
	if (!id) return undefined;
	const doc = deps.gameDoc!;
	const delay = getAiDelay(deps.gs!);
	const t = setTimeout(async () => {
		const m = buildAiMove({
			runtime: deps.runtime!,
			doc,
			playerIds: deps.playerIds,
			currentId: id
		});
		if (m) await deps.actions.playCard({ gameDoc: doc, playerId: m.playerId, card: m.card });
	}, delay);
	return () => clearTimeout(t);
}

const OH_WELL_BID_DELAY = 800;

export function setupOhWellAiBid(deps: AiEffectDeps): (() => void) | undefined {
	if (!shouldRunOhWellAiBid({ isHost: deps.isHost, doc: deps.gameDoc, gs: deps.gs }))
		return undefined;
	const doc = deps.gameDoc!;
	const t = setTimeout(async () => {
		const bidderId = getCurrentOhWellBidderId(doc);
		if (!bidderId) return;
		const bid = computeOhWellAiBid(doc);
		const updated = handleOhWellBid({ doc, playerId: bidderId, bid });
		await deps.actions.updateGameState(updated);
	}, OH_WELL_BID_DELAY);
	return () => clearTimeout(t);
}
