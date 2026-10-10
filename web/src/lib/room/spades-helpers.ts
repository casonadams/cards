import { createInitialSpadesState, applySpadesBid } from '$lib/games/spades/actions';
import { dealSpades } from '$lib/games/spades/deal';
import { computeSpadesAiBid } from '$lib/games/spades/ai';
import { isAiPlayer } from '$lib/platform/engine/index';
import type { GameDocument } from '$lib/platform/engine/index';
import type { SpadesRoundState, SpadesPlayerBid, SpadesBidType, SpadesGameMode } from '$lib/games/spades/types';
import type { DerivedState } from '$lib/platform/types/index';
import type { GameRoom } from '$lib/platform/types/index';
import type { RoomActions } from '$lib/platform/stores/room-store';

export interface InitSpadesParams {
	readonly playerIds: readonly string[];
	readonly dealerIndex?: number;
	readonly cumulativeScores?: Record<string, number>;
	readonly bags?: Record<string, number>;
	readonly mode?: SpadesGameMode;
}

export function initSpadesGameSpecific(params: InitSpadesParams): SpadesRoundState {
	return createInitialSpadesState(params);
}

export function getSpadesUiState(gs: DerivedState): SpadesRoundState | null {
	if (!gs.gameSpecific) return null;
	return gs.gameSpecific as SpadesRoundState;
}

export function isSpadesBiddingPhase(gs: DerivedState): boolean {
	return getSpadesUiState(gs)?.phase === 'bidding';
}

interface SpadesAiBidCheckParams {
	readonly isHost: boolean;
	readonly doc: GameDocument | null;
	readonly gs: DerivedState | null;
	readonly room?: GameRoom | null;
}

function hasRequiredContext(params: SpadesAiBidCheckParams): boolean {
	return params.isHost && params.doc !== null && params.gs !== null;
}

export function getCurrentSpadesBidderId(doc: GameDocument): string | undefined {
	const rs = doc.gameSpecific as SpadesRoundState | undefined;
	if (!rs || rs.phase !== 'bidding') return undefined;
	if (rs.currentBidder < 0 || rs.currentBidder >= doc.playerIds.length) return undefined;
	return doc.playerIds[rs.currentBidder];
}

function isCurrentBidderAi(doc: GameDocument, room?: GameRoom | null): boolean {
	const currentId = getCurrentSpadesBidderId(doc);
	if (!currentId) return false;
	if (isAiPlayer(currentId)) return true;
	const player = room?.players?.find((p) => p.id === currentId);
	if (player && player.isAiControlled && !player.isConnected) return true;
	return false;
}

export function shouldRunSpadesAiBid(params: SpadesAiBidCheckParams): boolean {
	if (params.room && params.room.gameDefinitionId !== 'spades') return false;
	if (!hasRequiredContext(params)) return false;
	if (!isSpadesBiddingPhase(params.gs!)) return false;
	return isCurrentBidderAi(params.doc!, params.room);
}

export function computeSpadesAiBidForDoc(doc: GameDocument, bidderId: string): SpadesPlayerBid {
	const aiIndex = doc.playerIds.indexOf(bidderId);
	const deal = dealSpades(doc.playerIds.length, doc.seed + doc.currentRound);
	const hand = deal.hands[aiIndex] ?? [];
	const bidRes = computeSpadesAiBid({ hand });
	return {
		playerId: bidderId,
		bidType: bidRes.bidType,
		amount: bidRes.amount
	};
}

export interface SpadesBidActionParams {
	readonly gameDoc: GameDocument | null;
	readonly playerId: string | undefined;
	readonly actions: RoomActions;
}

export async function handleSpadesBidAction(
	params: SpadesBidActionParams,
	bid: { bidType: SpadesBidType; amount: number }
): Promise<void> {
	if (!params.gameDoc || !params.playerId) return;
	const updated = applySpadesBid({
		doc: params.gameDoc,
		bid: {
			playerId: params.playerId,
			bidType: bid.bidType,
			amount: bid.amount
		}
	});
	await params.actions.updateGameState(updated);
}

export { applySpadesBid };
