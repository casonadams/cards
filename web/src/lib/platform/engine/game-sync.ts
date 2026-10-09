import type { ScoreEntry, Move } from '../types/index.ts';
import type { RealtimeSync } from '../ports/index.ts';

export type { Move };

export interface RoundScore {
	readonly round: number;
	readonly label: string;
	readonly scores: readonly ScoreEntry[];
}

export interface GameDocument {
	readonly roomId: string;
	readonly phase: string;
	readonly currentRound: number;
	readonly seed: number;
	readonly dealerIndex: number;
	readonly moves: readonly Move[];
	readonly playerIds: readonly string[];
	readonly roundScores: readonly RoundScore[];
	readonly gameSpecific?: unknown;
	readonly lastUpdate: number;
}

export interface GameSyncManager {
	subscribe(callback: (doc: GameDocument) => void): () => void;
	publishMove(current: GameDocument, move: Move): Promise<void>;
	publishPhaseChange(current: GameDocument, phase: string): Promise<void>;
	publishUpdate(doc: GameDocument): Promise<void>;
}

function buildSubscribe(sync: RealtimeSync<GameDocument>, roomId: string) {
	return (callback: (doc: GameDocument) => void) => sync.subscribe(roomId, callback);
}

function buildPublishMove(sync: RealtimeSync<GameDocument>, roomId: string) {
	return async (current: GameDocument, move: Move) => {
		await sync.publish(roomId, {
			...current,
			moves: [...current.moves, move],
			lastUpdate: Date.now()
		});
	};
}

function buildPublishPhaseChange(sync: RealtimeSync<GameDocument>, roomId: string) {
	return async (current: GameDocument, phase: string) => {
		await sync.publish(roomId, { ...current, phase, lastUpdate: Date.now() });
	};
}

export function createGameSyncManager(
	sync: RealtimeSync<GameDocument>,
	roomId: string
): GameSyncManager {
	return {
		subscribe: buildSubscribe(sync, roomId),
		publishMove: buildPublishMove(sync, roomId),
		publishPhaseChange: buildPublishPhaseChange(sync, roomId),
		async publishUpdate(doc: GameDocument) {
			await sync.publish(roomId, { ...doc, lastUpdate: Date.now() });
		}
	};
}
