import type { Card } from '../types/index.ts';
import type { GameRoomRepository, RealtimeSync } from '../ports/index.ts';
import type { Move, GameDocument, RoundScore } from '../engine/index.ts';
import { createGameSyncManager } from '../engine/index.ts';

export type { RoundScore };
export interface RoomActions {
	readonly startGame: (playerIds: readonly string[]) => Promise<void>;
	readonly playCard: (p: PlayCardParams) => Promise<void>;
	readonly advanceRound: (p: AdvanceRoundParams) => Promise<void>;
	readonly updateGameState: (doc: GameDocument) => Promise<void>;
	readonly returnToLobby: () => Promise<void>;
	readonly destroyRoom: () => Promise<void>;
}


export interface RoomActionsParams {
	readonly roomRepo: GameRoomRepository;
	readonly sync: RealtimeSync<GameDocument>;
	readonly roomId: string;
}

export interface PlayCardParams {
	gameDoc: GameDocument;
	playerId: string;
	card: Card;
}

function buildPlayCard(mgr: ReturnType<typeof createGameSyncManager>) {
	return async (p: PlayCardParams): Promise<void> => {
		const move: Move = { playerId: p.playerId, card: p.card, timestamp: Date.now() };
		await mgr.publishMove(p.gameDoc, move);
	};
}

function buildStartGame(params: RoomActionsParams, mgr: ReturnType<typeof createGameSyncManager>) {
	const { roomRepo, roomId } = params;
	return async (playerIds: readonly string[]): Promise<void> => {
		const seed = Math.floor(Math.random() * 2147483647);
		const doc: GameDocument = {
			roomId,
			phase: 'playing',
			currentRound: 0,
			seed,
			dealerIndex: 0,
			moves: [],
			playerIds: [...playerIds],
			roundScores: [],
			lastUpdate: Date.now()
		};
		await mgr.publishPhaseChange(doc, 'playing');
		await roomRepo.update(roomId, { phase: 'playing' });
	};
}

export interface AdvanceRoundParams {
	gameDoc: GameDocument;
	playerCount: number;
	roundScore: RoundScore;
}

function buildAdvanceRound(params: RoomActionsParams) {
	const { sync, roomId } = params;
	return async (p: AdvanceRoundParams): Promise<void> => {
		const nextDoc: GameDocument = {
			...p.gameDoc,
			currentRound: p.gameDoc.currentRound + 1,
			moves: [],
			dealerIndex: (p.gameDoc.dealerIndex + 1) % p.playerCount,
			roundScores: [...p.gameDoc.roundScores, p.roundScore],
			lastUpdate: Date.now()
		};
		await sync.publish(roomId, nextDoc);
	};
}

export function createRoomActions(params: RoomActionsParams) {
	const { roomRepo, roomId, sync } = params;
	const mgr = createGameSyncManager(sync, roomId);
	return {
		startGame: buildStartGame(params, mgr),
		playCard: buildPlayCard(mgr),
		advanceRound: buildAdvanceRound(params),
		async updateGameState(doc: GameDocument): Promise<void> {
			await mgr.publishUpdate(doc);
		},
		async returnToLobby(): Promise<void> {
			await sync.remove(roomId);
			await roomRepo.update(roomId, { phase: 'lobby' });
		},
		async destroyRoom(): Promise<void> {
			await sync.remove(roomId);
			await roomRepo.delete(roomId);
		}
	};
}
