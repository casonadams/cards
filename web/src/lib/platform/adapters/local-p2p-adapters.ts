import type { GameRoom } from '$lib/platform/types/index';
import type { GameDocument, Move } from '$lib/platform/engine/index';
import type { GameRoomRepository, RealtimeSync } from '$lib/platform/ports/index';
import { generateRoomCode } from '$lib/platform/engine/room-code';

export interface P2pBroadcaster {
	broadcast(msg: unknown): void;
}

function saveStorage(prefix: string, key: string, data: unknown): void {
	if (typeof window === 'undefined') return;
	try {
		const s = JSON.stringify(data);
		sessionStorage.setItem(`${prefix}_${key}`, s);
		localStorage.setItem(`${prefix}_${key}`, s);
	} catch {
		// Ignore storage quota errors
	}
}

function loadStorage<T>(prefix: string, key: string): T | null {
	if (typeof window === 'undefined') return null;
	const s = sessionStorage.getItem(`${prefix}_${key}`) || localStorage.getItem(`${prefix}_${key}`);
	if (!s) return null;
	try {
		return JSON.parse(s) as T;
	} catch {
		return null;
	}
}

function queryChannel<T>(
	channel: BroadcastChannel | null,
	query: unknown,
	match: (data: unknown) => T | null,
	fallback: () => T | null,
	timeoutMs = 400
): Promise<T | null> {
	if (!channel) return Promise.resolve(fallback());
	const { promise, resolve } = Promise.withResolvers<T | null>();
	const timeout = setTimeout(() => {
		channel.removeEventListener('message', handler);
		resolve(fallback());
	}, timeoutMs);

	const handler = (event: MessageEvent) => {
		const result = match(event.data);
		if (result) {
			clearTimeout(timeout);
			channel.removeEventListener('message', handler);
			resolve(result);
		}
	};
	channel.addEventListener('message', handler);
	channel.postMessage(query);
	return promise;
}

export function createLocalP2pRoomRepo(broadcaster?: () => P2pBroadcaster | null): GameRoomRepository {
	const rooms = new Map<string, GameRoom>();
	const listeners = new Map<string, Set<(r: GameRoom | null) => void>>();
	const channel =
		typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('cards-room-channel') : null;

	function persistRoom(room: GameRoom): void {
		rooms.set(room.id, room);
		saveStorage('cards_room_id', room.id, room);
		saveStorage('cards_room', room.code.trim().toUpperCase(), room);
	}

	function notify(id: string, broadcast = true): void {
		const room = rooms.get(id) ?? null;
		listeners.get(id)?.forEach((cb) => cb(room));
		if (!room) return;
		persistRoom(room);
		if (broadcast) {
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
		const data = event.data as { type?: string; room?: GameRoom; code?: string } | undefined;
		if (!data) return;
		if (data.type === 'sync_room' && data.room) {
			persistRoom(data.room);
			notify(data.room.id, false);
		} else if (data.type === 'query_room' && data.code) {
			const clean = data.code.trim().toUpperCase();
			const match = Array.from(rooms.values()).find((r) => r.code.trim().toUpperCase() === clean);
			if (match) {
				try {
					channel.postMessage(JSON.parse(JSON.stringify({ type: 'sync_room', room: match })));
				} catch {}
			}
		}
	});

	return {
		async create(room: Omit<GameRoom, 'id'>): Promise<GameRoom> {
			const id = crypto.randomUUID();
			const full: GameRoom = { ...room, id, code: room.code || generateRoomCode() };
			persistRoom(full);
			notify(id);
			return full;
		},

		async getById(id: string): Promise<GameRoom | null> {
			const mem = rooms.get(id);
			if (mem) return mem;
			const cached = loadStorage<GameRoom>('cards_room_id', id);
			if (cached) {
				rooms.set(cached.id, cached);
				return cached;
			}
			return null;
		},

		async getByCode(code: string): Promise<GameRoom | null> {
			const clean = code.trim().toUpperCase();
			const mem = Array.from(rooms.values()).find((r) => r.code.trim().toUpperCase() === clean);
			if (mem) return mem;
			const cached = loadStorage<GameRoom>('cards_room', clean);
			if (cached) {
				rooms.set(cached.id, cached);
				return cached;
			}
			return queryChannel<GameRoom>(
				channel,
				{ type: 'query_room', code: clean },
				(data) => {
					const msg = data as { type?: string; room?: GameRoom };
					if (msg?.type === 'sync_room' && msg.room && msg.room.code.trim().toUpperCase() === clean) {
						rooms.set(msg.room.id, msg.room);
						return msg.room;
					}
					return null;
				},
				() => Array.from(rooms.values()).find((r) => r.code.trim().toUpperCase() === clean) ?? null
			);
		},

		async update(id: string, data: Partial<GameRoom>, broadcast = true): Promise<void> {
			const existing = rooms.get(id) ?? loadStorage<GameRoom>('cards_room_id', id);
			const updated = { ...existing, ...data } as GameRoom;
			persistRoom(updated);
			notify(id, broadcast);
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

export function createLocalP2pSync(broadcaster?: () => P2pBroadcaster | null): RealtimeSync<GameDocument> {
	const docs = new Map<string, GameDocument>();
	const listeners = new Map<string, Set<(doc: GameDocument) => void>>();
	const channel =
		typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('cards-sync-channel') : null;

	function persistDoc(roomId: string, doc: GameDocument): void {
		docs.set(roomId, doc);
		saveStorage('cards_doc', roomId, doc);
	}

	function notify(roomId: string, doc: GameDocument, broadcast = true): void {
		persistDoc(roomId, doc);
		listeners.get(roomId)?.forEach((cb) => cb(doc));
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
		const data = event.data as { type?: string; roomId?: string; doc?: GameDocument } | undefined;
		if (data?.type === 'sync_doc' && data.roomId && data.doc) {
			persistDoc(data.roomId, data.doc);
			notify(data.roomId, data.doc, false);
		} else if (data?.type === 'query_doc' && data.roomId) {
			const current = docs.get(data.roomId);
			if (current) {
				try {
					channel?.postMessage({ type: 'sync_doc', roomId: data.roomId, doc: current });
				} catch {}
			}
		}
	});

	return {
		subscribe(roomId: string, callback: (doc: GameDocument) => void): () => void {
			if (!listeners.has(roomId)) {
				listeners.set(roomId, new Set());
			}
			listeners.get(roomId)!.add(callback);
			const existing = docs.get(roomId) ?? loadStorage<GameDocument>('cards_doc', roomId);
			if (existing) {
				callback(existing);
			}
			channel?.postMessage({ type: 'query_doc', roomId });
			return () => {
				listeners.get(roomId)?.delete(callback);
			};
		},

		async publish(roomId: string, state: GameDocument, broadcast = true): Promise<void> {
			notify(roomId, state, broadcast);
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
