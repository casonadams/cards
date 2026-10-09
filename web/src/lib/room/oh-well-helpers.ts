import { createInitialOhWellState, applyOhWellBid } from '$lib/games/oh-well/actions';
import { parseOhWellState } from '$lib/games/oh-well/parse-state';
import { isAiPlayer } from '$lib/platform/engine/index';
import type { GameDocument } from '$lib/platform/engine/index';
import type { OhWellRoundState } from '$lib/games/oh-well/types';
import type { OhWellUiState } from '$lib/games/oh-well/ui-state';
import type { DerivedState } from '$lib/platform/types/index';

function getDocState(doc: GameDocument): OhWellRoundState {
	return parseOhWellState({
		raw: doc.gameSpecific,
		currentRound: doc.currentRound,
		playerCount: doc.playerIds.length
	});
}

export interface InitOhWellParams {
	readonly playerIds: readonly string[];
	readonly dealerIndex: number;
	readonly seed: number;
	readonly currentRound: number;
}

export function initOhWellGameSpecific(params: InitOhWellParams): OhWellRoundState {
	return createInitialOhWellState(params);
}

interface BidActionParams {
	readonly doc: GameDocument;
	readonly playerId: string;
	readonly bid: number;
}

export function handleOhWellBid(params: BidActionParams): GameDocument {
	return applyOhWellBid(params);
}

export function getOhWellUiState(gs: DerivedState): OhWellUiState | null {
	if (!gs.gameSpecific) return null;
	return gs.gameSpecific as OhWellUiState;
}

export function isOhWellBiddingPhase(gs: DerivedState): boolean {
	return getOhWellUiState(gs)?.phase === 'bidding';
}

import type { GameRoom } from '$lib/platform/types/index';

interface AiBidCheckParams {
	readonly isHost: boolean;
	readonly doc: GameDocument | null;
	readonly gs: DerivedState | null;
	readonly room?: GameRoom | null;
}

function hasRequiredContext(params: AiBidCheckParams): boolean {
	return params.isHost && params.doc !== null && params.gs !== null;
}

function isBiddingWithAi(params: AiBidCheckParams): boolean {
	if (!hasRequiredContext(params)) return false;
	const ui = getOhWellUiState(params.gs!);
	return ui !== null && ui.phase === 'bidding';
}

export function getCurrentOhWellBidderId(doc: GameDocument): string | undefined {
	const rs = getDocState(doc);
	return doc.playerIds[rs.currentBidder];
}

function isCurrentBidderAi(doc: GameDocument, room?: GameRoom | null): boolean {
	const currentId = getCurrentOhWellBidderId(doc);
	if (!currentId) return false;
	if (isAiPlayer(currentId)) return true;
	const player = room?.players?.find((p) => p.id === currentId);
	if (player && player.isAiControlled && !player.isConnected) return true;
	return false;
}

export function shouldRunOhWellAiBid(params: AiBidCheckParams): boolean {
	if (!isBiddingWithAi(params)) return false;
	return isCurrentBidderAi(params.doc!, params.room);
}

export { computeOhWellAiBid } from './oh-well-ai-bid.ts';
