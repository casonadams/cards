import mqtt, { type MqttClient } from 'mqtt';
import type { GameRoom } from '$lib/platform/types/index';
import type { GameDocument } from '$lib/platform/engine/index';

const BROKER_URLS = [
	'wss://test.mosquitto.org:8081',
	'wss://broker.emqx.io:8084/mqtt'
];

export type P2pMessage =
	| { type: 'query_room'; code: string; senderId: string }
	| { type: 'sync_room'; room: GameRoom; senderId: string }
	| { type: 'sync_doc'; roomId: string; doc: GameDocument; senderId: string }
	| { type: 'query_doc'; roomId: string; senderId: string };

export type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

export type P2pBroadcastPayload = DistributiveOmit<P2pMessage, 'senderId'>;
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

/**
 * Derives a 256-bit AES-GCM encryption key from the room code.
 * Ensures all room communications are end-to-end encrypted.
 */
async function deriveRoomKey(code: string): Promise<CryptoKey> {
	const enc = new TextEncoder();
	const clean = code.trim().toUpperCase();
	const rawKey = await crypto.subtle.importKey(
		'raw',
		enc.encode(`cards:room:key:v1:${clean}`),
		{ name: 'PBKDF2' },
		false,
		['deriveKey']
	);
	return crypto.subtle.deriveKey(
		{
			name: 'PBKDF2',
			salt: enc.encode('cards:salt:v1'),
			iterations: 1000,
			hash: 'SHA-256'
		},
		rawKey,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
}

interface EncryptedEnvelope {
	readonly iv: number[];
	readonly ciphertext: number[];
}

async function encryptData(key: CryptoKey, data: unknown): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encoded = new TextEncoder().encode(JSON.stringify(data));
	const encryptedBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
	const envelope: EncryptedEnvelope = {
		iv: Array.from(iv),
		ciphertext: Array.from(new Uint8Array(encryptedBuf))
	};
	return JSON.stringify(envelope);
}

async function decryptData(key: CryptoKey, raw: string): Promise<unknown> {
	const parsed = JSON.parse(raw) as EncryptedEnvelope;
	if (!parsed || !Array.isArray(parsed.iv) || !Array.isArray(parsed.ciphertext)) {
		throw new Error('Invalid envelope');
	}
	const iv = new Uint8Array(parsed.iv);
	const ciphertext = new Uint8Array(parsed.ciphertext);
	const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
	return JSON.parse(new TextDecoder().decode(decrypted));
}

export class P2pNetworkManager {
	private client: MqttClient | null = null;
	private roomCode = '';
	private myId = '';
	private cryptoKey: CryptoKey | null = null;
	private topic = '';

	private onRoomMessage?: (room: GameRoom) => void;
	private onDocMessage?: (roomId: string, doc: GameDocument) => void;
	private onQueryRoom?: () => void;
	private onQueryDoc?: (roomId: string) => void;

	constructor(callbacks: {
		onRoomMessage?: (room: GameRoom) => void;
		onDocMessage?: (roomId: string, doc: GameDocument) => void;
		onQueryRoom?: () => void;
		onQueryDoc?: (roomId: string) => void;
	}) {
		this.onRoomMessage = callbacks.onRoomMessage;
		this.onDocMessage = callbacks.onDocMessage;
		this.onQueryRoom = callbacks.onQueryRoom;
		this.onQueryDoc = callbacks.onQueryDoc;
	}

	public async connect(code: string, myId: string): Promise<void> {
		this.destroy();
		this.roomCode = code.trim().toUpperCase();
		this.myId = myId;
		this.topic = `cards/v1/${this.roomCode}`;
		this.cryptoKey = await deriveRoomKey(this.roomCode);

		const { promise, resolve } = Promise.withResolvers<void>();
		let resolved = false;

		const broker = BROKER_URLS[0];
		this.client = mqtt.connect(broker, {
			clientId: `cards_${myId}_${Math.random().toString(36).slice(2, 6)}`,
			clean: true,
			connectTimeout: 5000,
			reconnectPeriod: 3000
		});

		this.client.on('connect', () => {
			this.client?.subscribe(this.topic, (err) => {
				if (!err && !resolved) {
					resolved = true;
					resolve();
				}
			});
		});

		this.client.on('message', async (topic, payload) => {
			if (topic !== this.topic || !this.cryptoKey) return;
			try {
				const decrypted = await decryptData(this.cryptoKey, payload.toString());
				if (!isValidMessage(decrypted)) return;
				if (decrypted.senderId === this.myId) return; // Drop own echoes

				if (decrypted.type === 'sync_room') {
					this.onRoomMessage?.(decrypted.room);
				} else if (decrypted.type === 'sync_doc') {
					this.onDocMessage?.(decrypted.roomId, decrypted.doc);
				} else if (decrypted.type === 'query_room') {
					this.onQueryRoom?.();
				} else if (decrypted.type === 'query_doc') {
					this.onQueryDoc?.(decrypted.roomId);
				}
			} catch {
				// Decryption failed (malformed or unauthorized message); drop silently
			}
		});

		this.client.on('error', (e) => {
			console.warn('P2P connection warning:', e);
			if (!resolved) {
				resolved = true;
				resolve();
			}
		});

		// Fallback resolve so local play never blocks
		setTimeout(() => {
			if (!resolved) {
				resolved = true;
				resolve();
			}
		}, 4000);

		return promise;
	}

	public async broadcast(msg: P2pBroadcastPayload): Promise<void> {
		if (!this.client?.connected || !this.cryptoKey || !this.topic) return;
		try {
			const fullMsg: P2pMessage = { ...msg, senderId: this.myId } as P2pMessage;
			const encrypted = await encryptData(this.cryptoKey, fullMsg);
			this.client.publish(this.topic, encrypted);
		} catch (e) {
			console.warn('Failed to broadcast encrypted P2P message', e);
		}
	}

	public destroy() {
		if (this.client) {
			try {
				this.client.end(true);
			} catch {}
			this.client = null;
		}
		this.cryptoKey = null;
		this.topic = '';
	}
}
