import { Peer, type DataConnection } from 'peerjs';
import type { GameRoom } from '$lib/platform/types/index';
import type { GameDocument } from '$lib/platform/engine/index';

const PEER_PREFIX = 'cards-v1-';
const MAX_PAYLOAD_SIZE = 64 * 1024; // 64 KB limit to prevent denial of service

export type P2pMessage =
	| { type: 'query_room'; code: string; guestId: string }
	| { type: 'sync_room'; room: GameRoom }
	| { type: 'sync_doc'; roomId: string; doc: GameDocument }
	| { type: 'query_doc'; roomId: string };

function sanitizeString(str: unknown, maxLen = 32): string {
	if (typeof str !== 'string') return '';
	return str.replace(/[^\w\s\-#]/g, '').slice(0, maxLen).trim();
}

const VALID_MESSAGE_TYPES: Record<string, true> = {
	query_room: true,
	sync_room: true,
	sync_doc: true,
	query_doc: true
};

function isValidMessage(data: unknown): data is P2pMessage {
	if (!data || typeof data !== 'object') return false;
	const msg = data as { type?: unknown };
	if (typeof msg.type !== 'string') return false;
	return Boolean(VALID_MESSAGE_TYPES[msg.type]);
}

export class P2pNetworkManager {
	private peer: Peer | null = null;
	private connections = new Map<string, DataConnection>();
	private isHost = false;
	private roomCode = '';
	private onRoomMessage?: (room: GameRoom) => void;
	private onDocMessage?: (roomId: string, doc: GameDocument) => void;
	private onQueryRoom?: (guestConn: DataConnection) => void;
	private onQueryDoc?: (roomId: string, guestConn: DataConnection) => void;

	constructor(callbacks: {
		onRoomMessage?: (room: GameRoom) => void;
		onDocMessage?: (roomId: string, doc: GameDocument) => void;
		onQueryRoom?: (guestConn: DataConnection) => void;
		onQueryDoc?: (roomId: string, guestConn: DataConnection) => void;
	}) {
		this.onRoomMessage = callbacks.onRoomMessage;
		this.onDocMessage = callbacks.onDocMessage;
		this.onQueryRoom = callbacks.onQueryRoom;
		this.onQueryDoc = callbacks.onQueryDoc;
	}

	/**
	 * Host registers the deterministic 6-letter room code on public STUN/WebRTC.
	 */
	public async startHost(code: string): Promise<string> {
		this.destroy();
		this.isHost = true;
		this.roomCode = sanitizeString(code, 6).toUpperCase();
		const peerId = `${PEER_PREFIX}${this.roomCode}`;

		const { promise, resolve, reject } = Promise.withResolvers<string>();
		try {
			this.peer = new Peer(peerId, {
				debug: 1,
				config: {
					iceServers: [
						{ urls: 'stun:stun.l.google.com:19302' },
						{ urls: 'stun:global.stun.twilio.com:3478' }
					]
				}
			});

			this.peer.on('open', (id) => {
				resolve(id);
			});

			this.peer.on('connection', (conn) => {
				this.setupConnection(conn);
			});

			this.peer.on('error', (err) => {
				if (err.type === 'unavailable-id') {
					resolve(peerId);
				} else {
					console.warn('P2P Host Peer error:', err);
					reject(err);
				}
			});
		} catch (e) {
			reject(e as Error);
		}
		return promise;
	}

	/**
	 * Guest connects to the deterministic 6-letter room code.
	 */
	public async joinHost(code: string, guestId: string): Promise<void> {
		this.destroy();
		this.isHost = false;
		this.roomCode = sanitizeString(code, 6).toUpperCase();
		const hostPeerId = `${PEER_PREFIX}${this.roomCode}`;

		const { promise, resolve } = Promise.withResolvers<void>();
		try {
			this.peer = new Peer({
				debug: 1,
				config: {
					iceServers: [
						{ urls: 'stun:stun.l.google.com:19302' },
						{ urls: 'stun:global.stun.twilio.com:3478' }
					]
				}
			});

			const timeout = setTimeout(() => {
				resolve();
			}, 6000);

			this.peer.on('open', () => {
				if (!this.peer) return;
				const conn = this.peer.connect(hostPeerId, { reliable: true });
				this.setupConnection(conn);

				conn.on('open', () => {
					clearTimeout(timeout);
					conn.send({ type: 'query_room', code: this.roomCode, guestId });
					resolve();
				});
			});

			this.peer.on('error', (err) => {
				console.warn('P2P Guest connect warning:', err);
				clearTimeout(timeout);
				resolve();
			});
		} catch (e) {
			console.warn('P2P Guest join error:', e);
			resolve();
		}
		return promise;
	}

	private setupConnection(conn: DataConnection) {
		const connId = conn.peer;
		this.connections.set(connId, conn);

		conn.on('data', (raw) => {
			if (typeof raw === 'string' && raw.length > MAX_PAYLOAD_SIZE) {
				console.warn('Dropped oversized P2P payload');
				return;
			}
			if (!isValidMessage(raw)) return;

			if (raw.type === 'sync_room' && raw.room) {
				this.onRoomMessage?.(raw.room);
			} else if (raw.type === 'sync_doc' && raw.roomId && raw.doc) {
				this.onDocMessage?.(raw.roomId, raw.doc);
			} else if (raw.type === 'query_room') {
				this.onQueryRoom?.(conn);
			} else if (raw.type === 'query_doc' && raw.roomId) {
				this.onQueryDoc?.(raw.roomId, conn);
			}
		});

		conn.on('close', () => {
			this.connections.delete(connId);
		});

		conn.on('error', () => {
			this.connections.delete(connId);
		});
	}

	/**
	 * Broadcast a room update or game doc to all connected P2P peers.
	 */
	public broadcast(msg: P2pMessage) {
		const serialized = JSON.parse(JSON.stringify(msg));
		for (const conn of this.connections.values()) {
			if (conn.open) {
				try {
					conn.send(serialized);
				} catch (e) {
					console.warn('Failed to send P2P message', e);
				}
			}
		}
	}

	public destroy() {
		for (const conn of this.connections.values()) {
			try {
				conn.close();
			} catch {}
		}
		this.connections.clear();
		if (this.peer) {
			try {
				this.peer.destroy();
			} catch {}
			this.peer = null;
		}
	}
}
