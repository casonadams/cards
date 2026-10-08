import type { GameRoom } from '$lib/platform/types/index';
import type { GameDocument, Move } from '$lib/platform/engine/index';
import type { GameRoomRepository, RealtimeSync } from '$lib/platform/ports/index';
import { generateRoomCode } from '$lib/platform/engine/room-code';

export function createLocalP2pRoomRepo(broadcaster?: () => P2pBroadcaster | null): GameRoomRepository {
	const rooms = new Map<string, GameRoom>();
	const listeners = new Map<string, Set<(r: GameRoom | null) => void>>();
	const channel =
		typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('cards-room-channel') : null;


	function notify(id: string, broadcast = true) {
		const room = rooms.get(id) ?? null;
		listeners.get(id)?.forEach((cb) => cb(room));
		if (typeof window !== 'undefined' && room) {
			try {
				const serialized = JSON.stringify(room);
				sessionStorage.setItem('cards_room_' + room.code.trim().toUpperCase(), serialized);
				sessionStorage.setItem('cards_room_id_' + room.id, serialized);
				localStorage.setItem('cards_room_' + room.code.trim().toUpperCase(), serialized);
				localStorage.setItem('cards_room_id_' + room.id, serialized);
			} catch {
				// Ignore
			}
		}
		if (broadcast && room) {
			try {
				const serialized = JSON.parse(JSON.stringify(room)) as GameRoom;
				channel?.postMessage({ type: 'sync_room', room: serialized });
				broadcaster?.()?.broadcast({ type: 'sync_room', room: serialized });
			} catch {
				// Ignore serialization errors
			}
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
					try {
						channel.postMessage(JSON.parse(JSON.stringify({ type: 'sync_room', room: r })));
					} catch {
						// Ignore
					}
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
			const mem = rooms.get(id);
			if (mem) return mem;
			if (typeof window !== 'undefined') {
				const cached = sessionStorage.getItem('cards_room_id_' + id) || localStorage.getItem('cards_room_id_' + id);
				if (cached) {
					try {
						const r = JSON.parse(cached) as GameRoom;
						rooms.set(r.id, r);
						return r;
					} catch {
						// Ignore
					}
				}
			}
			return null;
		},

		async getByCode(code: string): Promise<GameRoom | null> {
			const clean = code.trim().toUpperCase();
			for (const r of rooms.values()) {
				if (r.code.trim().toUpperCase() === clean) return r;
			}
			if (typeof window !== 'undefined') {
				const cached = sessionStorage.getItem('cards_room_' + clean) || localStorage.getItem('cards_room_' + clean);
				if (cached) {
					try {
						const r = JSON.parse(cached) as GameRoom;
						rooms.set(r.id, r);
						return r;
					} catch {
						// Ignore
					}
				}
			}
			if (channel) {
				const { promise, resolve } = Promise.withResolvers<GameRoom | null>();
				const timeout = setTimeout(() => {
					for (const r of rooms.values()) {
						if (r.code.trim().toUpperCase() === clean) {
							resolve(r);
							return;
						}
					}
					resolve(null);
				}, 400);

				const handler = (event: MessageEvent) => {
					if (event.data?.type === 'sync_room' && event.data.room) {
						const r = event.data.room as GameRoom;
						if (r.code.trim().toUpperCase() === clean) {
							clearTimeout(timeout);
							channel.removeEventListener('message', handler);
							rooms.set(r.id, r);
							resolve(r);
						}
					}
				};
				channel.addEventListener('message', handler);
				channel.postMessage({ type: 'query_room', code: clean });
				return promise;
			}
			return null;
		},

		async update(id: string, data: Partial<GameRoom>): Promise<void> {
			const cached = typeof window !== 'undefined'
				? sessionStorage.getItem('cards_room_id_' + id) || localStorage.getItem('cards_room_id_' + id)
				: null;
			const existing = rooms.get(id) ?? (cached ? JSON.parse(cached) : null);
			const updated = { ...existing, ...data } as GameRoom;
			rooms.set(id, updated);
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

export interface P2pBroadcaster {
	broadcast(msg: unknown): void;
}

export function createLocalP2pSync(broadcaster?: () => P2pBroadcaster | null): RealtimeSync<GameDocument> {
	const docs = new Map<string, GameDocument>();
	const listeners = new Map<string, Set<(doc: GameDocument) => void>>();
	const channel =
		typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('cards-sync-channel') : null;


	function notify(roomId: string, doc: GameDocument, broadcast = true) {
		docs.set(roomId, doc);
		listeners.get(roomId)?.forEach((cb) => cb(doc));
		if (typeof window !== 'undefined' && doc) {
			try {
				const serialized = JSON.stringify(doc);
				sessionStorage.setItem('cards_doc_' + roomId, serialized);
				localStorage.setItem('cards_doc_' + roomId, serialized);
			} catch {
				// Ignore
			}
		}
		if (broadcast) {
			try {
				const serialized = JSON.parse(JSON.stringify({ roomId, doc }));
				channel?.postMessage(serialized);
				broadcaster?.()?.broadcast({ type: 'sync_doc', roomId, doc });
			} catch {
				// Ignore serialization errors
			}
		}
	}
	channel?.addEventListener('message', (event) => {
		const data = event.data;
		if (data?.type === 'sync_doc' && data.roomId && data.doc) {
			notify(data.roomId, data.doc, false);
		} else if (data?.type === 'query_doc' && data.roomId) {
			const current = docs.get(data.roomId);
			if (current) {
				try {
					channel?.postMessage(JSON.parse(JSON.stringify({ type: 'sync_doc', roomId: data.roomId, doc: current })));
				} catch {
					// Ignore
				}
			}
		}
	});
	return {
		subscribe(roomId: string, callback: (doc: GameDocument) => void): () => void {
			if (!listeners.has(roomId)) {
				listeners.set(roomId, new Set());
			}
			listeners.get(roomId)!.add(callback);
			const existing = docs.get(roomId);
			if (existing) {
				callback(existing);
			} else if (typeof window !== 'undefined') {
				const cached = sessionStorage.getItem('cards_doc_' + roomId);
				if (cached) {
					try {
						const d = JSON.parse(cached) as GameDocument;
						notify(roomId, d, false);
					} catch {
						// Ignore
					}
				}
				channel?.postMessage({ type: 'query_doc', roomId });
			}
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
