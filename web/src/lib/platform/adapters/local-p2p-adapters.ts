import type { GameRoom } from '$lib/platform/types/index';
import type { GameDocument, Move } from '$lib/platform/engine/index';
import type { GameRoomRepository, RealtimeSync } from '$lib/platform/ports/index';
import { generateRoomCode } from '$lib/platform/engine/room-code';

export function createLocalP2pRoomRepo(broadcaster?: () => IrohBroadcaster | null): GameRoomRepository {
	const rooms = new Map<string, GameRoom>();
	const listeners = new Map<string, Set<(r: GameRoom | null) => void>>();
	const channel =
		typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('cards-room-channel') : null;

	function notify(id: string, broadcast = true) {
		const room = rooms.get(id) ?? null;
		listeners.get(id)?.forEach((cb) => cb(room));
		if (broadcast && room) {
			channel?.postMessage({ type: 'sync_room', room });
			broadcaster?.()?.broadcast(JSON.stringify({ type: 'sync_room', room })).catch(() => {});
		}
	}

	channel?.addEventListener('message', (event) => {
		const data = event.data;
		if (!data) return;
		if (data.type === 'sync_room' && data.room) {
			rooms.set(data.room.id, data.room);
			notify(data.room.id, false);
		} else if (data.type === 'query_room' && data.code) {
			const clean = data.code.trim().toUpperCase();
			for (const r of rooms.values()) {
				if (r.code.trim().toUpperCase() === clean) {
					channel.postMessage({ type: 'sync_room', room: r });
					break;
				}
			}
		}
	});

	return {
		async create(room: Omit<GameRoom, 'id'>): Promise<GameRoom> {
			const id = crypto.randomUUID();
			const full: GameRoom = { ...room, id, code: room.code || generateRoomCode() };
			rooms.set(id, full);
			notify(id);
			return full;
		},

		async getById(id: string): Promise<GameRoom | null> {
			return rooms.get(id) ?? null;
		},

		async getByCode(code: string): Promise<GameRoom | null> {
			const clean = code.trim().toUpperCase();
			for (const r of rooms.values()) {
				if (r.code.trim().toUpperCase() === clean) return r;
			}
			if (channel) {
				channel.postMessage({ type: 'query_room', code: clean });
				const { promise, resolve } = Promise.withResolvers<void>();
				setTimeout(resolve, 150);
				await promise;
				for (const r of rooms.values()) {
					if (r.code.trim().toUpperCase() === clean) return r;
				}
			}
			return null;
		},

		async update(id: string, data: Partial<GameRoom>): Promise<void> {
			const existing = rooms.get(id);
			if (!existing) return;
			rooms.set(id, { ...existing, ...data });
			notify(id);
		},

		async delete(id: string): Promise<void> {
			rooms.delete(id);
			notify(id);
		},

		onRoomChanged(id: string, callback: (room: GameRoom | null) => void): () => void {
			if (!listeners.has(id)) {
				listeners.set(id, new Set());
			}
			listeners.get(id)!.add(callback);
			callback(rooms.get(id) ?? null);
			return () => {
				listeners.get(id)?.delete(callback);
			};
		},

		async deleteStaleRooms(): Promise<number> {
			return 0;
		}
	};
}

export interface IrohBroadcaster {
	broadcast(msg: string): Promise<void>;
}

export function createLocalP2pSync(broadcaster?: () => IrohBroadcaster | null): RealtimeSync<GameDocument> {
	const docs = new Map<string, GameDocument>();
	const listeners = new Map<string, Set<(doc: GameDocument) => void>>();
	const channel =
		typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('cards-sync-channel') : null;

	function notify(roomId: string, doc: GameDocument, broadcast = true) {
		docs.set(roomId, doc);
		listeners.get(roomId)?.forEach((cb) => cb(doc));
		if (broadcast) {
			channel?.postMessage({ type: 'sync_doc', roomId, doc });
			broadcaster?.()?.broadcast(JSON.stringify({ type: 'sync_doc', roomId, doc })).catch(() => {});
		}
	}

	channel?.addEventListener('message', (event) => {
		const data = event.data;
		if (data?.type === 'sync_doc' && data.roomId && data.doc) {
			notify(data.roomId, data.doc, false);
		}
	});
	return {
		subscribe(roomId: string, callback: (doc: GameDocument) => void): () => void {
			if (!listeners.has(roomId)) {
				listeners.set(roomId, new Set());
			}
			listeners.get(roomId)!.add(callback);
			const existing = docs.get(roomId);
			if (existing) callback(existing);
			return () => {
				listeners.get(roomId)?.delete(callback);
			};
		},

		async publish(roomId: string, state: GameDocument): Promise<void> {
			notify(roomId, state);
		},

		async appendMove(roomId: string, move: unknown): Promise<void> {
			const current = docs.get(roomId);
			if (!current) return;
			const next: GameDocument = {
				...current,
				moves: [...current.moves, move as unknown as Move],
				lastUpdate: Date.now()
			};
			notify(roomId, next);
		},

		async remove(roomId: string): Promise<void> {
			docs.delete(roomId);
		}
	};
}
