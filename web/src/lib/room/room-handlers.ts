import type { GameDocument } from '$lib/platform/engine/index';
import type { GameRoom, GameRuntime } from '$lib/platform/types/index';
import type { DerivedGameState } from '$lib/platform/stores/game-store';
import type { GameRoomRepository } from '$lib/platform/ports/game-room-repository';
import type { RoomActions } from '$lib/platform/stores/room-store';
import {
	buildRoundResult,
	makeAiPlayer,
	getNextRoundPlayerCount,
	canAdvanceRound
} from './room-helpers';
import { initOhWellGameSpecific } from './oh-well-helpers';
import { initSpadesGameSpecific } from './spades-helpers';
import type { SpadesRoundState } from '$lib/games/spades/types';

const MAX_SEED = 2147483647;

export interface HandleStartParams {
	readonly gameId: string;
	readonly playerIds: readonly string[];
	readonly roomId: string;
	readonly actions: RoomActions;
	readonly roomRepo: GameRoomRepository;
}

function buildGameSpecific(params: HandleStartParams, seed: number): unknown {
	if (params.gameId === 'oh-well') {
		return initOhWellGameSpecific({
			playerIds: params.playerIds,
			dealerIndex: 0,
			seed,
			currentRound: 0
		});
	}
	if (params.gameId === 'spades') {
		return initSpadesGameSpecific({
			playerIds: params.playerIds,
			dealerIndex: 0
		});
	}
	return undefined;
}

export async function handleStart(params: HandleStartParams): Promise<void> {
	if (params.gameId !== 'oh-well' && params.gameId !== 'spades') {
		await params.actions.startGame(params.playerIds);
		return;
	}
	const seed = Math.floor(Math.random() * MAX_SEED);
	const doc: GameDocument = {
		roomId: params.roomId,
		phase: 'playing',
		currentRound: 0,
		seed,
		dealerIndex: 0,
		moves: [],
		playerIds: [...params.playerIds],
		roundScores: [],
		gameSpecific: buildGameSpecific(params, seed),
		lastUpdate: Date.now()
	};
	await params.actions.updateGameState(doc);
	await params.roomRepo.update(params.roomId, { phase: 'playing' });
}

export interface GameDeps {
	readonly runtime: GameRuntime;
	readonly gameDoc: GameDocument;
	readonly gs: DerivedGameState;
	readonly playerIds: readonly string[];
	readonly room: GameRoom | null;
	readonly actions: RoomActions;
}

function buildNextSpecific(gameId: string, d: GameDeps): unknown {
	const nextDealer = (d.gameDoc.dealerIndex + 1) % d.playerIds.length;
	if (gameId === 'oh-well') {
		return initOhWellGameSpecific({
			playerIds: d.playerIds,
			dealerIndex: nextDealer,
			seed: d.gameDoc.seed,
			currentRound: d.gameDoc.currentRound + 1
		});
	}
	if (gameId === 'spades') {
		const prevRs = d.gameDoc.gameSpecific as SpadesRoundState | undefined;
		return initSpadesGameSpecific({
			playerIds: d.playerIds,
			dealerIndex: nextDealer,
			cumulativeScores: prevRs?.cumulativeScores,
			bags: prevRs?.bags
		});
	}
	return undefined;
}

async function advanceCustomRound(gameId: string, d: GameDeps): Promise<void> {
	const roundScore = buildRoundResult({ runtime: d.runtime, doc: d.gameDoc, gs: d.gs });
	const nextDoc: GameDocument = {
		...d.gameDoc,
		currentRound: d.gameDoc.currentRound + 1,
		moves: [],
		dealerIndex: (d.gameDoc.dealerIndex + 1) % d.playerIds.length,
		roundScores: [...d.gameDoc.roundScores, roundScore],
		gameSpecific: buildNextSpecific(gameId, d),
		lastUpdate: Date.now()
	};
	await d.actions.updateGameState(nextDoc);
}

async function advanceGenericRound(d: GameDeps): Promise<void> {
	const roundScore = buildRoundResult({ runtime: d.runtime, doc: d.gameDoc, gs: d.gs });
	await d.actions.advanceRound({
		gameDoc: d.gameDoc,
		playerCount: getNextRoundPlayerCount(d.room),
		roundScore
	});
}

export async function handleNextRound(gameId: string, deps: GameDeps): Promise<void> {
	if (!canAdvanceRound(deps.gameDoc, deps.gs)) return;
	if (gameId === 'oh-well' || gameId === 'spades') {
		await advanceCustomRound(gameId, deps);
		return;
	}
	await advanceGenericRound(deps);
}

export interface AddAiParams {
	readonly room: GameRoom | null;
	readonly isFull: boolean;
	readonly aiCounter: number;
	readonly roomId: string;
	readonly roomRepo: GameRoomRepository;
}

export async function handleAddAi(params: AddAiParams): Promise<number> {
	if (!params.room || params.isFull) return params.aiCounter;
	const existing = new Set(
		params.room.players
			.filter((p) => p.id.startsWith('ai-'))
			.map((p) => parseInt(p.id.replace('ai-', ''), 10))
			.filter((n) => !isNaN(n))
	);
	let nextIndex = params.aiCounter;
	while (existing.has(nextIndex)) {
		nextIndex++;
	}
	const np = [...params.room.players, makeAiPlayer(nextIndex)];
	await params.roomRepo.update(params.roomId, { players: np, playerIds: np.map((p) => p.id) });
	return nextIndex + 1;
}
