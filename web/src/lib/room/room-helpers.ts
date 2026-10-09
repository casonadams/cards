import { isAiPlayer, createAiPlayerId, getAiDisplayName } from '$lib/platform/engine/index';
import type { GameRuntime, GameRoom, Card } from '$lib/platform/types/index';
import type { GameDocument } from '$lib/platform/engine/index';
import type { RoomPlayer } from '$lib/platform/types/index';
import type { DerivedGameState } from '$lib/platform/stores/game-store';
import type { RoundScore } from '$lib/platform/stores/room-store';
import type { GameRoomRepository } from '$lib/platform/ports/game-room-repository';

export function getAiCurrentId(
	playerIds: readonly string[],
	gs: DerivedGameState,
	room?: GameRoom | null
): string | null {
	const id = playerIds[gs.currentTurnIndex];
	if (!id) return null;
	if (isAiPlayer(id)) return id;
	if (room?.players?.some((p) => p.id === id && p.isAiControlled)) {
		return id;
	}
	return null;
}

export interface AiMoveInput {
	runtime: GameRuntime;
	doc: GameDocument;
	playerIds: readonly string[];
	currentId: string;
}

export function buildAiMove(input: AiMoveInput) {
	return input.runtime.computeAiMove({
		moves: input.doc.moves,
		seed: input.doc.seed,
		currentRound: input.doc.currentRound,
		playerCount: input.playerIds.length,
		playerIds: input.playerIds,
		aiPlayerId: input.currentId,
		dealerIndex: input.doc.dealerIndex,
		gameSpecific: input.doc.gameSpecific
	});
}

export async function executeSingleSkipTurn(params: {
	runtime: GameRuntime;
	doc: GameDocument;
	playerIds: readonly string[];
	currentId: string;
	actions: {
		playCard: (args: { gameDoc: GameDocument; playerId: string; card: Card }) => Promise<unknown>;
	};
}): Promise<boolean> {
	const m = buildAiMove({
		runtime: params.runtime,
		doc: params.doc,
		playerIds: params.playerIds,
		currentId: params.currentId
	});
	if (m && m.card) {
		await params.actions.playCard({
			gameDoc: params.doc,
			playerId: m.playerId,
			card: m.card
		});
		return true;
	}
	return false;
}

export interface RoundResultInput {
	runtime: GameRuntime;
	doc: GameDocument;
	gs: DerivedGameState;
}

export function buildRoundResult(input: RoundResultInput): RoundScore {
	const r = input.doc.currentRound;
	return { round: r, label: input.runtime.getRoundLabel(r), scores: input.gs.roundScores! };
}

export function makeAiPlayer(index: number): RoomPlayer {
	return {
		id: createAiPlayerId(index),
		displayName: getAiDisplayName(index),
		isHost: false,
		isConnected: true,
		lastSeen: Date.now()
	};
}

export function isPlayingPhase(roomId: string, phase: string | undefined): boolean {
	return Boolean(roomId) && phase === 'playing';
}

function hasAiContext(params: {
	isHost: boolean;
	gameDoc: GameDocument | null;
	gs: DerivedGameState | null;
}): boolean {
	if (!params.isHost) return false;
	return Boolean(params.gameDoc && params.gs);
}

export function shouldRunAi(params: {
	isHost: boolean;
	gameDoc: GameDocument | null;
	gs: DerivedGameState | null;
}): boolean {
	if (!hasAiContext(params)) return false;
	return !params.gs!.isRoundComplete;
}

export function getAiDelay(gs: DerivedGameState): number {
	const isNewTrick = gs.trickPlays.length === 0 && gs.lastCompleteTrick.length > 0;
	return isNewTrick ? 2500 : 500;
}

export function getNextRoundPlayerCount(room: { players: { length: number } } | null): number {
	return room?.players.length ?? 4;
}

export function canAdvanceRound(
	gameDoc: GameDocument | null,
	gs: DerivedGameState | null
): boolean {
	return Boolean(gameDoc && gs?.roundScores);
}

interface RoomGsCtx {
	readonly gameDoc: GameDocument | null;
	readonly player: { readonly id: string } | null;
	readonly room: GameRoom | null;
	readonly playerIds: readonly string[];
	readonly runtime: GameRuntime | null;
}

function hasGsContext(ctx: RoomGsCtx): boolean {
	return Boolean(ctx.gameDoc && ctx.player && ctx.runtime);
}

function isRoomPlaying(ctx: RoomGsCtx): boolean {
	return ctx.room?.phase === 'playing';
}

export function deriveRoomGs(ctx: RoomGsCtx): DerivedGameState | null {
	if (!hasGsContext(ctx) || !isRoomPlaying(ctx)) return null;
	return ctx.runtime!.deriveState({
		moves: ctx.gameDoc!.moves,
		seed: ctx.gameDoc!.seed,
		currentRound: ctx.gameDoc!.currentRound,
		playerCount: ctx.room!.players.length,
		playerIds: ctx.playerIds,
		myId: ctx.player!.id,
		dealerIndex: ctx.gameDoc!.dealerIndex,
		gameSpecific: ctx.gameDoc!.gameSpecific
	});
}

export function buildPlayerNames(players: readonly RoomPlayer[]): Record<string, string> {
	return Object.fromEntries(players.map((p) => [p.id, p.displayName]));
}

export function needsGameSync(room: GameRoom | null, isDominion: boolean): boolean {
	return room?.phase === 'playing' && !isDominion;
}

interface AddAiParams {
	readonly room: GameRoom;
	readonly roomId: string;
	readonly aiIndex: number;
	readonly roomRepo: GameRoomRepository;
}

export async function addAiToRoom(p: AddAiParams): Promise<void> {
	const np = [...p.room.players, makeAiPlayer(p.aiIndex)];
	await p.roomRepo.update(p.roomId, { players: np, playerIds: np.map((pl) => pl.id) });
}
