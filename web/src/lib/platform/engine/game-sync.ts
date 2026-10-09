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

export function deduplicateMoves(moves: readonly Move[]): readonly Move[] {
	const seen = new Set<string>();
	const result: Move[] = [];
	for (const m of moves) {
		const key = `${m.playerId}:${m.card?.suit ?? ''}:${m.card?.rank ?? ''}:${m.timestamp}`;
		if (!seen.has(key)) {
			seen.add(key);
			result.push(m);
		}
	}
	return result;
}

export function shouldAcceptDocUpdate(
	incoming: GameDocument,
	current: GameDocument | null
): boolean {
	if (!incoming) return false;
	if (!current) return true;

	// Reject if incoming is from an earlier round
	if (incoming.currentRound < current.currentRound) {
		return false;
	}

	// For the same round, reject out-of-order state regression
	if (incoming.currentRound === current.currentRound) {
		// Reject if incoming has fewer moves for this round
		if (incoming.moves.length < current.moves.length) {
			return false;
		}
		// If moves count is equal, reject if incoming lastUpdate timestamp is older
		if (incoming.moves.length === current.moves.length) {
			if ((incoming.lastUpdate ?? 0) < (current.lastUpdate ?? 0)) {
				return false;
			}
		}
	}

	return true;
}

export class DocDedupCache {
	private readonly seen = new Set<string>();
	private readonly maxEntries: number;

	constructor(maxEntries = 200) {
		this.maxEntries = maxEntries;
	}

	public getDocKey(doc: GameDocument): string {
		return `${doc.roomId}:${doc.currentRound}:${doc.moves.length}:${doc.lastUpdate}`;
	}

	public has(doc: GameDocument): boolean {
		return this.seen.has(this.getDocKey(doc));
	}

	public add(doc: GameDocument): void {
		const key = this.getDocKey(doc);
		this.seen.add(key);
		if (this.seen.size > this.maxEntries) {
			const oldest = this.seen.values().next().value;
			if (oldest) {
				this.seen.delete(oldest);
			}
		}
	}

	public clear(): void {
		this.seen.clear();
	}
}

function buildSubscribe(sync: RealtimeSync<GameDocument>, roomId: string) {
	return (callback: (doc: GameDocument) => void) => sync.subscribe(roomId, callback);
}

function buildPublishMove(sync: RealtimeSync<GameDocument>, roomId: string) {
	return async (current: GameDocument, move: Move) => {
		const isDuplicate = current.moves.some(
			(m) =>
				m.playerId === move.playerId &&
				m.card?.suit === move.card?.suit &&
				m.card?.rank === move.card?.rank &&
				m.timestamp === move.timestamp
		);
		if (isDuplicate) return;

		await sync.publish(roomId, {
			...current,
			moves: [...current.moves, move],
			lastUpdate: Math.max((current.lastUpdate ?? 0) + 1, Date.now())
		});
	};
}

function buildPublishPhaseChange(sync: RealtimeSync<GameDocument>, roomId: string) {
	return async (current: GameDocument, phase: string) => {
		await sync.publish(roomId, {
			...current,
			phase,
			lastUpdate: Math.max((current.lastUpdate ?? 0) + 1, Date.now())
		});
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
			const sanitizedMoves = deduplicateMoves(doc.moves);
			await sync.publish(roomId, {
				...doc,
				moves: sanitizedMoves,
				lastUpdate: Math.max((doc.lastUpdate ?? 0) + 1, Date.now())
			});
		}
	};
}
