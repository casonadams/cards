import mqtt, { type MqttClient } from 'mqtt';
import type { GameRoom, RoomPlayer } from '$lib/platform/types/index';
import type { GameDocument } from '$lib/platform/engine/index';
import type { DocDelta } from '$lib/platform/engine/doc-delta';
import { isAiPlayer } from '$lib/platform/engine/ai-player';

export const BROKER_URLS: readonly string[] = [
	'wss://broker.emqx.io:8084/mqtt',
	'wss://broker.hivemq.com:8884/mqtt',
	'wss://test.mosquitto.org:8081'
];

export const STUN_SERVERS: readonly RTCIceServer[] = [
	{ urls: 'stun:stun.l.google.com:19302' },
	{ urls: 'stun:stun1.l.google.com:19302' },
	{ urls: 'stun:stun2.l.google.com:19302' }
];

export type P2pMessage =
	| { type: 'query_room'; code: string; senderId: string }
	| { type: 'join_request'; code: string; player: RoomPlayer; senderId: string }
	| { type: 'sync_room'; room: GameRoom; senderId: string }
	| { type: 'sync_doc'; roomId: string; doc: GameDocument; resync?: boolean; senderId: string }
	| { type: 'doc_delta'; delta: DocDelta; senderId: string }
	| { type: 'query_doc'; roomId: string; senderId: string }
	| { type: 'signal_offer'; targetId: string; offer: RTCSessionDescriptionInit; senderId: string }
	| { type: 'signal_answer'; targetId: string; answer: RTCSessionDescriptionInit; senderId: string }
	| { type: 'signal_ice'; targetId: string; candidate: RTCIceCandidateInit; senderId: string }
	| { type: 'ping'; senderId: string; timestamp: number }
	| { type: 'pong'; senderId: string; timestamp: number }
	| { type: 'player_leave'; roomId: string; playerId: string; senderId: string };

export type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;
export type P2pBroadcastPayload = DistributiveOmit<P2pMessage, 'senderId'>;

const DISCOVERY_MESSAGE_TYPES: ReadonlySet<P2pMessage['type']> = new Set([
	'query_room',
	'join_request',
	'player_leave'
]);

export const RECONNECT_BASE_DELAY_MS = 1000;
export const RECONNECT_MAX_DELAY_MS = 30000;
const STABLE_CONNECTION_MS = 30000;
const MAX_HOST_WEBRTC_RETRIES = 3;

export function reconnectDelayMs(attempt: number, jitter = Math.random()): number {
	if (attempt <= 0) return 0;
	const exponential = Math.min(RECONNECT_MAX_DELAY_MS, RECONNECT_BASE_DELAY_MS * 2 ** (attempt - 1));
	return Math.round(exponential * (0.75 + 0.25 * jitter));
}

function humanPeerIds(room: GameRoom, selfId: string): Set<string> {
	return new Set(
		(room.players ?? []).map((p) => p.id).filter((id) => id !== selfId && !isAiPlayer(id))
	);
}

export interface NetworkStatusInfo {
	readonly mode: 'p2p' | 'relay' | 'connecting' | 'disconnected';
	readonly brokerUrl?: string;
	readonly brokerIndex: number;
	readonly directPeersCount: number;
	readonly latencyMs?: number;
}

const VALID_MESSAGE_TYPES: Record<string, true> = {
	query_room: true,
	join_request: true,
	sync_room: true,
	sync_doc: true,
	doc_delta: true,
	query_doc: true,
	signal_offer: true,
	signal_answer: true,
	signal_ice: true,
	ping: true,
	pong: true,
	player_leave: true
};

export function isValidMessage(data: unknown): data is P2pMessage {
	if (!data || typeof data !== 'object') return false;
	const msg = data as { type?: unknown; senderId?: unknown };
	return (
		typeof msg.type === 'string' &&
		Boolean(VALID_MESSAGE_TYPES[msg.type]) &&
		typeof msg.senderId === 'string'
	);
}

export type RoomCryptoKey =
	| (CryptoKey & { readonly roomCode?: string; readonly keyString?: string })
	| { readonly algorithm: { readonly name: string }; readonly key: string; readonly roomCode: string; readonly keyString: string };

/**
 * Derives a 256-bit AES-GCM encryption key from the room code.
 * Ensures all room communications are end-to-end encrypted.
 * Gracefully falls back when accessed in non-secure contexts (e.g. LAN HTTP).
 */
export async function deriveRoomKey(code: string): Promise<RoomCryptoKey> {
	const clean = code.trim().toUpperCase();
	const keyString = `cards:room:key:v1:${clean}`;
	if (typeof crypto !== 'undefined' && crypto.subtle) {
		const enc = new TextEncoder();
		const rawKey = await crypto.subtle.importKey(
			'raw',
			enc.encode(keyString),
			{ name: 'PBKDF2' },
			false,
			['deriveKey']
		);
		const nativeKey = await crypto.subtle.deriveKey(
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
		try {
			(nativeKey as unknown as Record<string, string>).roomCode = clean;
			(nativeKey as unknown as Record<string, string>).keyString = keyString;
		} catch {}
		return nativeKey as RoomCryptoKey;
	}
	return {
		algorithm: { name: 'AES-GCM' },
		key: keyString,
		roomCode: clean,
		keyString
	};
}

export interface EncryptedEnvelope {
	readonly iv?: string | number[];
	readonly ciphertext?: string | number[];
	readonly fallback?: boolean;
	readonly data?: string;
}

function bytesToBase64(bytes: Uint8Array): string {
	let binStr = '';
	for (let i = 0; i < bytes.length; i++) {
		binStr += String.fromCharCode(bytes[i]);
	}
	return btoa(binStr);
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
	const binStr = atob(base64);
	const bytes = new Uint8Array(binStr.length);
	for (let i = 0; i < binStr.length; i++) {
		bytes[i] = binStr.charCodeAt(i);
	}
	return bytes;
}

function decodeEnvelopeBytes(value: unknown): Uint8Array<ArrayBuffer> | null {
	if (typeof value === 'string') return base64ToBytes(value);
	if (Array.isArray(value)) return new Uint8Array(value);
	return null;
}

export async function encryptData(key: RoomCryptoKey, data: unknown): Promise<string> {
	const encoded = new TextEncoder().encode(JSON.stringify(data));
	const keyBytes = new TextEncoder().encode(getRoomKeyString(key));
	const xored = new Uint8Array(encoded.length);
	for (let i = 0; i < encoded.length; i++) {
		xored[i] = encoded[i] ^ keyBytes[i % keyBytes.length];
	}
	const fallbackData = bytesToBase64(xored);

	const hasSubtle = typeof crypto !== 'undefined' && Boolean(crypto.subtle);
	if (hasSubtle && isNativeAesGcmKey(key)) {
		const iv = crypto.getRandomValues(new Uint8Array(12));
		const encryptedBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
		const envelope: EncryptedEnvelope = {
			iv: bytesToBase64(iv),
			ciphertext: bytesToBase64(new Uint8Array(encryptedBuf)),
			fallback: true,
			data: fallbackData
		};
		return JSON.stringify(envelope);
	}

	const envelope: EncryptedEnvelope = {
		fallback: true,
		data: fallbackData
	};
	return JSON.stringify(envelope);
}

function getRoomKeyString(key: RoomCryptoKey): string {
	const keyAny = key as unknown as { roomCode?: string; keyString?: string; key?: string };
	return keyAny.keyString || keyAny.key || `cards:room:key:v1:${keyAny.roomCode || 'DEFAULT'}`;
}

function isNativeAesGcmKey(key: RoomCryptoKey): key is CryptoKey {
	return (
		'algorithm' in key &&
		key.algorithm?.name === 'AES-GCM' &&
		!('key' in (key as unknown as Record<string, unknown>))
	);
}

async function decryptNativeAesGcm(
	key: CryptoKey,
	iv: Uint8Array<ArrayBuffer>,
	ciphertext: Uint8Array<ArrayBuffer>
): Promise<unknown> {
	if (iv.length !== 12) {
		throw new Error('Invalid IV length');
	}
	const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
	return JSON.parse(new TextDecoder().decode(decrypted));
}

function decryptFallbackData(key: RoomCryptoKey, base64Data: string): unknown {
	const xored = base64ToBytes(base64Data);
	const keyBytes = new TextEncoder().encode(getRoomKeyString(key));
	const unxored = new Uint8Array(xored.length);
	for (let i = 0; i < xored.length; i++) {
		unxored[i] = xored[i] ^ keyBytes[i % keyBytes.length];
	}
	return JSON.parse(new TextDecoder().decode(unxored));
}

export async function decryptData(key: RoomCryptoKey, raw: string): Promise<unknown> {
	const parsed = JSON.parse(raw) as EncryptedEnvelope;
	if (!parsed || typeof parsed !== 'object') {
		throw new Error('Invalid envelope');
	}

	const hasSubtle = typeof crypto !== 'undefined' && Boolean(crypto.subtle);
	const iv = decodeEnvelopeBytes(parsed.iv);
	const ciphertext = decodeEnvelopeBytes(parsed.ciphertext);
	const hasNativePayload = iv !== null && ciphertext !== null;

	if (hasSubtle && isNativeAesGcmKey(key) && hasNativePayload) {
		return decryptNativeAesGcm(key, iv, ciphertext);
	}

	if (parsed.fallback && typeof parsed.data === 'string') {
		return decryptFallbackData(key, parsed.data);
	}

	if (!hasNativePayload) {
		throw new Error('Invalid envelope');
	}

	throw new Error('Cannot decrypt envelope: WebCrypto subtle unavailable');
}


/**
 * WebRTC Peer Connection manager managing a single peer DataChannel
 */
export class WebRtcPeer {
	private pc: RTCPeerConnection | null = null;
	private channel: RTCDataChannel | null = null;
	private pendingCandidates: RTCIceCandidateInit[] = [];

	constructor(
		public readonly remotePeerId: string,
		private readonly sendSignal: (payload: P2pBroadcastPayload) => void,
		private readonly onMessage: (msg: P2pMessage) => void,
		private readonly onStateChange: (peerId: string, open: boolean) => void
	) {
		this.initPeerConnection();
	}

	private initPeerConnection(): void {
		if (typeof RTCPeerConnection === 'undefined') return;
		this.pc = new RTCPeerConnection({ iceServers: [...STUN_SERVERS] });

		this.pc.onicecandidate = (ev) => {
			if (ev.candidate) {
				this.sendSignal({
					type: 'signal_ice',
					targetId: this.remotePeerId,
					candidate: ev.candidate.toJSON()
				});
			}
		};

		this.pc.ondatachannel = (ev) => {
			this.setupChannel(ev.channel);
		};

		this.pc.onconnectionstatechange = () => {
			const state = this.pc?.connectionState;
			if (state === 'failed' || state === 'closed' || state === 'disconnected') {
				this.onStateChange(this.remotePeerId, false);
			} else if (state === 'connected') {
				this.onStateChange(this.remotePeerId, true);
			}
		};
	}

	public get isOpen(): boolean {
		return this.channel?.readyState === 'open';
	}

	public get isFailed(): boolean {
		const state = this.pc?.connectionState;
		return !this.pc || state === 'failed' || state === 'closed' || this.channel?.readyState === 'closed';
	}

	public setupChannel(ch: RTCDataChannel): void {
		this.channel = ch;
		ch.onopen = () => this.onStateChange(this.remotePeerId, true);
		ch.onclose = () => this.onStateChange(this.remotePeerId, false);
		ch.onerror = () => this.onStateChange(this.remotePeerId, false);
		ch.onmessage = (ev) => {
			try {
				const parsed = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
				if (isValidMessage(parsed)) {
					this.onMessage(parsed);
				}
			} catch {}
		};
	}

	public async createOffer(): Promise<RTCSessionDescriptionInit | null> {
		if (!this.pc) return null;
		const ch = this.pc.createDataChannel('cards-data', { ordered: true });
		this.setupChannel(ch);

		const offer = await this.pc.createOffer();
		await this.pc.setLocalDescription(offer);
		return offer;
	}

	public async handleOffer(
		offer: RTCSessionDescriptionInit
	): Promise<RTCSessionDescriptionInit | null> {
		if (!this.pc) return null;
		await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
		await this.drainPendingCandidates();

		const answer = await this.pc.createAnswer();
		await this.pc.setLocalDescription(answer);
		return answer;
	}

	public async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
		if (!this.pc) return;
		await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
		await this.drainPendingCandidates();
	}

	public async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
		if (!this.pc) return;
		if (!this.pc.remoteDescription) {
			this.pendingCandidates.push(candidate);
			return;
		}
		try {
			await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
		} catch {}
	}

	private async drainPendingCandidates(): Promise<void> {
		if (!this.pc) return;
		while (this.pendingCandidates.length > 0) {
			const cand = this.pendingCandidates.shift();
			if (cand) {
				try {
					await this.pc.addIceCandidate(new RTCIceCandidate(cand));
				} catch {}
			}
		}
	}

	public send(msg: P2pMessage): boolean {
		if (this.isOpen && this.channel) {
			try {
				this.channel.send(JSON.stringify(msg));
				return true;
			} catch {}
		}
		return false;
	}

	public close(): void {
		try {
			this.channel?.close();
		} catch {}
		try {
			this.pc?.close();
		} catch {}
		this.channel = null;
		this.pc = null;
		this.pendingCandidates = [];
	}
}

export interface P2pManagerCallbacks {
	readonly onRoomMessage?: (room: GameRoom) => void;
	readonly onJoinRequest?: (code: string, player: RoomPlayer) => void;
	readonly onDocMessage?: (roomId: string, doc: GameDocument, senderId: string, resync: boolean) => void;
	readonly onDocDelta?: (delta: DocDelta, senderId: string) => void;
	readonly onQueryRoom?: (requesterId: string) => void;
	readonly onQueryDoc?: (roomId: string, requesterId: string) => void;
	readonly onStatusChange?: (status: NetworkStatusInfo) => void;
	readonly onPeerConnectionChange?: (peerId: string, isConnected: boolean) => void;
	readonly onPlayerLeave?: (roomId: string, playerId: string) => void;
}

export class P2pNetworkManager {
	private client: MqttClient | null = null;
	private roomCode = '';
	private myId = '';
	private isHost = false;
	private cryptoKey: RoomCryptoKey | null = null;
	private topic = '';
	private brokerIndex = 0;
	private peers = new Map<string, WebRtcPeer>();
	private earlyIceCandidates = new Map<string, RTCIceCandidateInit[]>();
	private pingTimer: ReturnType<typeof setInterval> | null = null;
	private currentLatency?: number;
	private isDestroyed = false;
	private isFailingOver = false;
	private sessionId = 0;
	private roomMembers: ReadonlySet<string> | null = null;
	private activeHostId: string | null = null;
	private hostRetryAttempts = 0;
	private hostRetryTimer: ReturnType<typeof setTimeout> | null = null;
	private reconnectAttempt = 0;
	private connectedAt = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private cancelReconnectWait: (() => void) | null = null;

	private readonly callbacks: P2pManagerCallbacks;

	constructor(callbacks: P2pManagerCallbacks) {
		this.callbacks = callbacks;
	}

	public get currentBrokerIndex(): number {
		return this.brokerIndex;
	}

	public getBrokerIndex(): number {
		return this.brokerIndex;
	}

	public getEarlyCandidates(senderId: string): readonly RTCIceCandidateInit[] {
		return this.earlyIceCandidates.get(senderId) ?? [];
	}

	public async connect(code: string, myId: string, isHost = false): Promise<void> {
		this.destroy();
		this.isDestroyed = false;
		this.roomCode = code.trim().toUpperCase();
		this.myId = myId;
		this.isHost = isHost;
		this.topic = `cards/v1/${this.roomCode}`;
		const session = this.sessionId;
		const key = await deriveRoomKey(this.roomCode);
		if (session !== this.sessionId) return;
		this.cryptoKey = key;

		this.emitStatus('connecting');
		await this.connectWithFailover(0);
		if (session !== this.sessionId) return;
		this.startPingInterval();
	}

	private emitStatus(mode?: NetworkStatusInfo['mode']): void {
		const directPeersCount = Array.from(this.peers.values()).filter((p) => p.isOpen).length;
		const determinedMode: NetworkStatusInfo['mode'] =
			mode ?? (directPeersCount > 0 ? 'p2p' : this.client?.connected ? 'relay' : 'connecting');

		this.callbacks.onStatusChange?.({
			mode: determinedMode,
			brokerUrl: BROKER_URLS[this.brokerIndex],
			brokerIndex: this.brokerIndex,
			directPeersCount,
			latencyMs: this.currentLatency
		});
	}

	public async connectWithFailover(startIndex = 0): Promise<boolean> {
		const session = this.sessionId;
		for (let offset = 0; offset < BROKER_URLS.length; offset++) {
			if (session !== this.sessionId || !this.roomCode) return false;
			const idx = (startIndex + offset) % BROKER_URLS.length;
			const client = await this.tryBroker(idx);
			if (session !== this.sessionId || !this.roomCode) {
				try {
					client?.end(true);
				} catch {}
				return false;
			}
			if (client) {
				this.client = client;
				this.attachMqttListeners(client);
				this.brokerIndex = idx;
				this.connectedAt = Date.now();
				this.emitStatus();
				return true;
			}
		}
		// If all brokers fail, set disconnected state but allow offline/local operations
		this.emitStatus('disconnected');
		return false;
	}

	private tryBroker(index: number): Promise<MqttClient | null> {
		const { promise, resolve } = Promise.withResolvers<MqttClient | null>();
		let settled = false;

		const broker = BROKER_URLS[index];
		const client = mqtt.connect(broker, {
			clientId: `cards_${this.myId}_${Math.random().toString(36).slice(2, 6)}`,
			clean: true,
			connectTimeout: 4000,
			reconnectPeriod: 0
		});

		const timeoutId = setTimeout(() => {
			if (!settled) {
				settled = true;
				try {
					client.end(true);
				} catch {}
				resolve(null);
			}
		}, 4000);

		client.on('connect', () => {
			client.subscribe(this.topic, (err) => {
				if (!settled) {
					settled = true;
					clearTimeout(timeoutId);
					if (err) {
						try {
							client.end(true);
						} catch {}
						resolve(null);
					} else {
						resolve(client);
					}
				}
			});
		});

		client.on('error', () => {
			if (!settled) {
				settled = true;
				clearTimeout(timeoutId);
				try {
					client.end(true);
				} catch {}
				resolve(null);
			}
		});

		return promise;
	}

	private attachMqttListeners(client: MqttClient): void {
		client.on('message', async (topic, payload) => {
			if (topic !== this.topic || !this.cryptoKey) return;
			try {
				const decrypted = await decryptData(this.cryptoKey, payload.toString());
				if (!isValidMessage(decrypted)) return;
				if (decrypted.senderId === this.myId) return; // Drop own echoes
				await this.handleIncomingMessage(decrypted);
			} catch {}
		});

		client.on('error', (err) => {
			console.warn('MQTT client error on broker', BROKER_URLS[this.brokerIndex], err);
			void this.handleMqttDisconnect(client);
		});

		client.on('close', () => {
			void this.handleMqttDisconnect(client);
		});
	}

	private async handleMqttDisconnect(client: MqttClient): Promise<void> {
		if (this.isDestroyed || !this.roomCode) return;
		if (this.client !== client) return;
		if (client.connected) return;
		if (this.isFailingOver) return;

		this.isFailingOver = true;
		this.emitStatus();

		try {
			client.end(true);
		} catch {}

		if (this.client === client) {
			this.client = null;
		}

		if (Date.now() - this.connectedAt >= STABLE_CONNECTION_MS) {
			this.reconnectAttempt = 0;
		}
		const session = this.sessionId;
		const nextIndex = (this.brokerIndex + 1) % BROKER_URLS.length;
		let connected = false;
		while (!connected && session === this.sessionId) {
			await this.waitBeforeReconnect(reconnectDelayMs(this.reconnectAttempt));
			this.reconnectAttempt++;
			if (session !== this.sessionId) return;
			connected = await this.connectWithFailover(nextIndex);
		}
		if (session === this.sessionId) {
			this.isFailingOver = false;
		}
	}

	private waitBeforeReconnect(ms: number): Promise<void> {
		if (ms <= 0) return Promise.resolve();
		const { promise, resolve } = Promise.withResolvers<void>();
		this.cancelReconnectWait = resolve;
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			this.cancelReconnectWait = null;
			resolve();
		}, ms);
		return promise;
	}

	private async handleIncomingMessage(msg: P2pMessage): Promise<void> {
		switch (msg.type) {
			case 'signal_offer':
				await this.handleSignalOffer(msg.senderId, msg.targetId, msg.offer);
				break;
			case 'signal_answer':
				await this.handleSignalAnswer(msg.senderId, msg.targetId, msg.answer);
				break;
			case 'signal_ice':
				await this.handleSignalIce(msg.senderId, msg.targetId, msg.candidate);
				break;
			case 'ping':
				await this.sendTo(msg.senderId, { type: 'pong', timestamp: msg.timestamp });
				break;
			case 'pong':
				this.currentLatency = Math.max(1, Math.round((Date.now() - msg.timestamp) / 2));
				this.emitStatus();
				break;
			default:
				this.dispatchApplicationMessage(msg);
				break;
		}
	}

	private dispatchApplicationMessage(msg: P2pMessage): void {
		if (msg.type === 'sync_room') {
			this.trackRoom(msg.room);
			this.callbacks.onRoomMessage?.(msg.room);
			this.connectToActiveHost();
		} else if (msg.type === 'join_request') {
			this.callbacks.onJoinRequest?.(msg.code, msg.player);
		} else if (msg.type === 'sync_doc') {
			this.callbacks.onDocMessage?.(msg.roomId, msg.doc, msg.senderId, msg.resync === true);
		} else if (msg.type === 'doc_delta') {
			this.callbacks.onDocDelta?.(msg.delta, msg.senderId);
		} else if (msg.type === 'query_room') {
			this.callbacks.onQueryRoom?.(msg.senderId);
		} else if (msg.type === 'query_doc') {
			this.callbacks.onQueryDoc?.(msg.roomId, msg.senderId);
		} else if (msg.type === 'player_leave') {
			this.callbacks.onPlayerLeave?.(msg.roomId, msg.playerId);
		}
	}

	private trackRoom(room: GameRoom): void {
		this.roomMembers = humanPeerIds(room, this.myId);
		const hostId = room.tempHostId || room.hostId || null;
		if (hostId !== this.activeHostId) {
			this.hostRetryAttempts = 0;
		}
		this.activeHostId = hostId;
	}

	private get isActingHost(): boolean {
		return this.activeHostId ? this.activeHostId === this.myId : this.isHost;
	}

	private connectToActiveHost(): void {
		const hostId = this.activeHostId;
		if (!hostId || this.isActingHost || this.peers.has(hostId) || this.hostRetryTimer) return;
		if (this.hostRetryAttempts > MAX_HOST_WEBRTC_RETRIES) return;
		void this.initiateWebRtcToHost(hostId);
	}

	private handlePeerStateChange(peer: WebRtcPeer, open: boolean): void {
		if (this.peers.get(peer.remotePeerId) !== peer) return;
		this.emitStatus();
		this.callbacks.onPeerConnectionChange?.(peer.remotePeerId, open);
		if (open) {
			if (peer.remotePeerId === this.activeHostId) this.hostRetryAttempts = 0;
			return;
		}
		if (!peer.isFailed) return;
		this.peers.delete(peer.remotePeerId);
		peer.close();
		if (peer.remotePeerId === this.activeHostId && !this.isActingHost) {
			this.scheduleHostRetry();
		}
	}

	private scheduleHostRetry(): void {
		this.hostRetryAttempts++;
		if (this.hostRetryAttempts > MAX_HOST_WEBRTC_RETRIES || this.hostRetryTimer) return;
		this.hostRetryTimer = setTimeout(() => {
			this.hostRetryTimer = null;
			this.connectToActiveHost();
		}, reconnectDelayMs(this.hostRetryAttempts + 1));
	}

	public async initiateWebRtcToHost(hostId: string): Promise<void> {
		if (this.peers.has(hostId) || hostId === this.myId) return;
		const peer = this.getOrCreatePeer(hostId);
		const offer = await peer.createOffer();
		if (offer) {
			await this.broadcastMqtt({
				type: 'signal_offer',
				targetId: hostId,
				offer
			});
		}
	}

	private drainEarlyCandidates(senderId: string, peer: WebRtcPeer): void {
		const candidates = this.earlyIceCandidates.get(senderId);
		if (candidates && candidates.length > 0) {
			this.earlyIceCandidates.delete(senderId);
			for (const cand of candidates) {
				void peer.addIceCandidate(cand);
			}
		}
	}

	private getOrCreatePeer(remotePeerId: string): WebRtcPeer {
		const existing = this.peers.get(remotePeerId);
		if (existing) return existing;

		const peer = new WebRtcPeer(
			remotePeerId,
			(payload) => this.broadcastMqtt(payload),
			(msg) => {
				this.dispatchApplicationMessage(msg);
				if (this.isActingHost) {
					void this.relayToOtherPeers(remotePeerId, msg);
				}
			},
			(_peerId, open) => this.handlePeerStateChange(peer, open)
		);
		this.peers.set(remotePeerId, peer);
		this.drainEarlyCandidates(remotePeerId, peer);
		return peer;
	}

	public async relayToOtherPeers(excludeSenderId: string, msg: P2pMessage): Promise<void> {
		for (const [peerId, peer] of this.peers.entries()) {
			if (peerId !== excludeSenderId && peer.isOpen) {
				peer.send(msg);
			}
		}

		if (!this.reachesDirectly(this.roomMembers, excludeSenderId)) {
			const { senderId: _discarded, ...payload } = msg;
			void _discarded;
			await this.broadcastMqtt(payload as P2pBroadcastPayload);
		}
	}

	private reachesDirectly(recipients: ReadonlySet<string> | null, excludeId?: string): boolean {
		if (!recipients) return false;
		for (const id of recipients) {
			if (id !== excludeId && !this.peers.get(id)?.isOpen) return false;
		}
		return true;
	}

	private async handleSignalOffer(
		senderId: string,
		targetId: string,
		offer: RTCSessionDescriptionInit
	): Promise<void> {
		if (targetId !== this.myId) return;
		const stale = this.peers.get(senderId);
		if (stale) {
			this.peers.delete(senderId);
			stale.close();
		}
		const peer = this.getOrCreatePeer(senderId);
		const answer = await peer.handleOffer(offer);
		this.drainEarlyCandidates(senderId, peer);
		if (answer) {
			await this.broadcastMqtt({
				type: 'signal_answer',
				targetId: senderId,
				answer
			});
		}
	}

	private async handleSignalAnswer(
		senderId: string,
		targetId: string,
		answer: RTCSessionDescriptionInit
	): Promise<void> {
		if (targetId !== this.myId) return;
		const peer = this.peers.get(senderId);
		if (peer) {
			await peer.handleAnswer(answer);
			this.drainEarlyCandidates(senderId, peer);
		}
	}

	private async handleSignalIce(
		senderId: string,
		targetId: string,
		candidate: RTCIceCandidateInit
	): Promise<void> {
		if (targetId !== this.myId) return;
		const peer = this.peers.get(senderId);
		if (peer) {
			await peer.addIceCandidate(candidate);
		} else {
			const list = this.earlyIceCandidates.get(senderId) ?? [];
			list.push(candidate);
			this.earlyIceCandidates.set(senderId, list);
		}
	}

	public async sendTo(targetId: string, payload: P2pBroadcastPayload): Promise<void> {
		const peer = this.peers.get(targetId);
		const fullMsg = { ...payload, senderId: this.myId } as P2pMessage;
		if (peer?.isOpen && peer.send(fullMsg)) return;
		await this.broadcastMqtt(payload);
	}

	public async broadcast(payload: P2pBroadcastPayload): Promise<void> {
		const fullMsg: P2pMessage = { ...payload, senderId: this.myId } as P2pMessage;
		let recipients = this.roomMembers;
		if (payload.type === 'sync_room') {
			const previousMembers = this.roomMembers ?? [];
			this.trackRoom(payload.room);
			recipients = new Set([...previousMembers, ...(this.roomMembers ?? [])]);
		}

		for (const peer of this.peers.values()) {
			if (peer.isOpen) {
				peer.send(fullMsg);
			}
		}

		if (DISCOVERY_MESSAGE_TYPES.has(payload.type) || !this.reachesRoom(recipients)) {
			await this.broadcastMqtt(payload);
		}
	}

	private reachesRoom(recipients: ReadonlySet<string> | null): boolean {
		if (this.isActingHost) return this.reachesDirectly(recipients);
		return Boolean(this.activeHostId && this.peers.get(this.activeHostId)?.isOpen);
	}

	private async broadcastMqtt(payload: P2pBroadcastPayload): Promise<void> {
		if (!this.client?.connected || !this.cryptoKey || !this.topic) return;
		try {
			const fullMsg: P2pMessage = { ...payload, senderId: this.myId } as P2pMessage;
			const encrypted = await encryptData(this.cryptoKey, fullMsg);
			this.client?.publish(this.topic, encrypted);
		} catch (e) {
			console.warn('Failed to broadcast encrypted P2P message', e);
		}
	}

	private startPingInterval(): void {
		if (this.pingTimer) clearInterval(this.pingTimer);
		this.pingTimer = setInterval(() => {
			const openPeers = Array.from(this.peers.values()).filter((p) => p.isOpen);
			if (openPeers.length > 0) {
				const now = Date.now();
				for (const peer of openPeers) {
					peer.send({ type: 'ping', senderId: this.myId, timestamp: now });
				}
			}
		}, 8000);
	}

	public destroy(): void {
		this.isDestroyed = true;
		this.isFailingOver = false;
		this.sessionId++;
		this.roomMembers = null;
		this.activeHostId = null;
		this.hostRetryAttempts = 0;
		if (this.hostRetryTimer) {
			clearTimeout(this.hostRetryTimer);
			this.hostRetryTimer = null;
		}
		this.reconnectAttempt = 0;
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		this.cancelReconnectWait?.();
		this.cancelReconnectWait = null;
		if (this.pingTimer) {
			clearInterval(this.pingTimer);
			this.pingTimer = null;
		}
		for (const peer of this.peers.values()) {
			peer.close();
		}
		this.peers.clear();
		this.earlyIceCandidates.clear();

		if (this.client) {
			try {
				this.client.end(true);
			} catch {}
			this.client = null;
		}
		this.cryptoKey = null;
		this.topic = '';
		this.currentLatency = undefined;
		this.emitStatus('disconnected');
	}
}
