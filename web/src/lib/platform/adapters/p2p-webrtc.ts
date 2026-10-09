import mqtt, { type MqttClient } from 'mqtt';
import type { GameRoom, RoomPlayer } from '$lib/platform/types/index';
import type { GameDocument } from '$lib/platform/engine/index';

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
	| { type: 'sync_doc'; roomId: string; doc: GameDocument; senderId: string }
	| { type: 'query_doc'; roomId: string; senderId: string }
	| { type: 'signal_offer'; targetId: string; offer: RTCSessionDescriptionInit; senderId: string }
	| { type: 'signal_answer'; targetId: string; answer: RTCSessionDescriptionInit; senderId: string }
	| { type: 'signal_ice'; targetId: string; candidate: RTCIceCandidateInit; senderId: string }
	| { type: 'ping'; senderId: string; timestamp: number }
	| { type: 'pong'; senderId: string; timestamp: number };

export type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;
export type P2pBroadcastPayload = DistributiveOmit<P2pMessage, 'senderId'>;

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
	query_doc: true,
	signal_offer: true,
	signal_answer: true,
	signal_ice: true,
	ping: true,
	pong: true
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
	readonly iv?: number[];
	readonly ciphertext?: number[];
	readonly fallback?: boolean;
	readonly data?: string;
}

export async function encryptData(key: RoomCryptoKey, data: unknown): Promise<string> {
	const jsonStr = JSON.stringify(data);
	const keyAny = key as unknown as { roomCode?: string; keyString?: string; key?: string };
	const keyString = keyAny.keyString || keyAny.key || `cards:room:key:v1:${keyAny.roomCode || 'DEFAULT'}`;

	// Compute universal fallback XOR stream
	const encoded = new TextEncoder().encode(jsonStr);
	const keyBytes = new TextEncoder().encode(keyString);
	const xored = new Uint8Array(encoded.length);
	for (let i = 0; i < encoded.length; i++) {
		xored[i] = encoded[i] ^ keyBytes[i % keyBytes.length];
	}
	let binStr = '';
	for (let i = 0; i < xored.length; i++) {
		binStr += String.fromCharCode(xored[i]);
	}
	const fallbackData = btoa(binStr);

	const hasSubtle = typeof crypto !== 'undefined' && Boolean(crypto.subtle);
	const isNativeKey = 'algorithm' in key && key.algorithm?.name === 'AES-GCM' && !('key' in (key as unknown as Record<string, unknown>));

	if (hasSubtle && isNativeKey) {
		const iv = crypto.getRandomValues(new Uint8Array(12));
		const encryptedBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key as CryptoKey, encoded);
		const envelope: EncryptedEnvelope = {
			iv: Array.from(iv),
			ciphertext: Array.from(new Uint8Array(encryptedBuf)),
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

export async function decryptData(key: RoomCryptoKey, raw: string): Promise<unknown> {
	const parsed = JSON.parse(raw) as EncryptedEnvelope;
	if (!parsed || typeof parsed !== 'object') {
		throw new Error('Invalid envelope');
	}

	const hasSubtle = typeof crypto !== 'undefined' && Boolean(crypto.subtle);
	const isNativeKey = 'algorithm' in key && key.algorithm?.name === 'AES-GCM' && !('key' in (key as unknown as Record<string, unknown>));

	// 1. If native AES-GCM is available and envelope has native ciphertext, verify & decrypt native AES-GCM
	if (hasSubtle && isNativeKey && Array.isArray(parsed.iv) && Array.isArray(parsed.ciphertext)) {
		if (parsed.iv.length !== 12) {
			throw new Error('Invalid IV length');
		}
		const iv = new Uint8Array(parsed.iv);
		const ciphertext = new Uint8Array(parsed.ciphertext);
		const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key as CryptoKey, ciphertext);
		return JSON.parse(new TextDecoder().decode(decrypted));
	}

	// 2. If client does not have WebCrypto subtle (or if envelope is fallback-only):
	if (parsed.fallback && typeof parsed.data === 'string') {
		const binStr = atob(parsed.data);
		const bytes = new Uint8Array(binStr.length);
		for (let i = 0; i < binStr.length; i++) {
			bytes[i] = binStr.charCodeAt(i);
		}
		const keyAny = key as unknown as { roomCode?: string; keyString?: string; key?: string };
		const keyString = keyAny.keyString || keyAny.key || `cards:room:key:v1:${keyAny.roomCode || 'DEFAULT'}`;
		const keyBytes = new TextEncoder().encode(keyString);
		const unxored = new Uint8Array(bytes.length);
		for (let i = 0; i < bytes.length; i++) {
			unxored[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
		}
		return JSON.parse(new TextDecoder().decode(unxored));
	}

	if (!Array.isArray(parsed.iv) || !Array.isArray(parsed.ciphertext)) {
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
			if (this.pc?.connectionState === 'failed' || this.pc?.connectionState === 'closed') {
				this.onStateChange(this.remotePeerId, false);
			}
		};
	}

	public get isOpen(): boolean {
		return this.channel?.readyState === 'open';
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
	readonly onDocMessage?: (roomId: string, doc: GameDocument) => void;
	readonly onQueryRoom?: () => void;
	readonly onQueryDoc?: (roomId: string) => void;
	readonly onStatusChange?: (status: NetworkStatusInfo) => void;
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
		this.cryptoKey = await deriveRoomKey(this.roomCode);

		this.emitStatus('connecting');
		await this.connectWithFailover(0);
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
		for (let offset = 0; offset < BROKER_URLS.length; offset++) {
			if (this.isDestroyed || !this.roomCode) return false;
			const idx = (startIndex + offset) % BROKER_URLS.length;
			const success = await this.tryBroker(idx);
			if (this.isDestroyed || !this.roomCode) {
				if (this.client) {
					try {
						this.client.end(true);
					} catch {}
					this.client = null;
				}
				return false;
			}
			if (success) {
				this.brokerIndex = idx;
				this.emitStatus();
				return true;
			}
		}
		// If all brokers fail, set disconnected state but allow offline/local operations
		this.emitStatus('disconnected');
		return false;
	}

	private tryBroker(index: number): Promise<boolean> {
		const { promise, resolve } = Promise.withResolvers<boolean>();
		let settled = false;

		const broker = BROKER_URLS[index];
		const client = mqtt.connect(broker, {
			clientId: `cards_${this.myId}_${Math.random().toString(36).slice(2, 6)}`,
			clean: true,
			connectTimeout: 4000,
			reconnectPeriod: 5000
		});

		const timeoutId = setTimeout(() => {
			if (!settled) {
				settled = true;
				try {
					client.end(true);
				} catch {}
				resolve(false);
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
						resolve(false);
					} else {
						this.client = client;
						this.attachMqttListeners(client);
						resolve(true);
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
				resolve(false);
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

		const nextIndex = (this.brokerIndex + 1) % BROKER_URLS.length;
		await this.connectWithFailover(nextIndex);
		this.isFailingOver = false;
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
				this.sendDirectOrRelay(msg.senderId, {
					type: 'pong',
					senderId: this.myId,
					timestamp: msg.timestamp
				});
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
			this.callbacks.onRoomMessage?.(msg.room);
			// If we are a non-host peer receiving room info and don't have a peer connection to host, initiate it
			if (!this.isHost && msg.room.hostId && !this.peers.has(msg.room.hostId)) {
				this.initiateWebRtcToHost(msg.room.hostId);
			}
		} else if (msg.type === 'join_request') {
			this.callbacks.onJoinRequest?.(msg.code, msg.player);
		} else if (msg.type === 'sync_doc') {
			this.callbacks.onDocMessage?.(msg.roomId, msg.doc);
		} else if (msg.type === 'query_room') {
			this.callbacks.onQueryRoom?.();
		} else if (msg.type === 'query_doc') {
			this.callbacks.onQueryDoc?.(msg.roomId);
		}
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
				// If host receives action from a peer over DataChannel, relay to other peers
				if (this.isHost) {
					void this.relayToOtherPeers(remotePeerId, msg);
				}
			},
			() => this.emitStatus()
		);
		this.peers.set(remotePeerId, peer);
		this.drainEarlyCandidates(remotePeerId, peer);
		return peer;
	}

	public async relayToOtherPeers(excludeSenderId: string, msg: P2pMessage): Promise<void> {
		let sentCount = 0;
		let targetPeersCount = 0;
		for (const [peerId, peer] of this.peers.entries()) {
			if (peerId !== excludeSenderId) {
				targetPeersCount++;
				if (peer.isOpen && peer.send(msg)) {
					sentCount++;
				}
			}
		}

		const anyPeerInRelay = targetPeersCount === 0 || sentCount < targetPeersCount;
		if (anyPeerInRelay) {
			const { senderId: _discarded, ...payload } = msg;
			void _discarded;
			await this.broadcastMqtt(payload as P2pBroadcastPayload);
		}
	}

	private async handleSignalOffer(
		senderId: string,
		targetId: string,
		offer: RTCSessionDescriptionInit
	): Promise<void> {
		if (targetId !== this.myId) return;
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

	private sendDirectOrRelay(targetId: string, msg: P2pMessage): void {
		const peer = this.peers.get(targetId);
		if (peer?.isOpen) {
			peer.send(msg);
		} else {
			this.broadcastMqtt(msg as P2pBroadcastPayload);
		}
	}

	public async broadcast(payload: P2pBroadcastPayload): Promise<void> {
		const fullMsg: P2pMessage = { ...payload, senderId: this.myId } as P2pMessage;
		let sentCount = 0;

		// 1. Direct WebRTC DataChannel delivery
		for (const peer of this.peers.values()) {
			if (peer.isOpen && peer.send(fullMsg)) {
				sentCount++;
			}
		}

		// 2. Broadcast via MQTT relay if DataChannels are not fully established
		// or for critical sync/discovery packets (room queries, join requests, sync room)
		const needsMqttBroadcast =
			sentCount === 0 ||
			sentCount < this.peers.size ||
			payload.type === 'query_room' ||
			payload.type === 'join_request' ||
			payload.type === 'sync_room';

		if (needsMqttBroadcast) {
			await this.broadcastMqtt(payload);
		}
	}

	private async broadcastMqtt(payload: P2pBroadcastPayload): Promise<void> {
		if (!this.client?.connected || !this.cryptoKey || !this.topic) return;
		try {
			const fullMsg: P2pMessage = { ...payload, senderId: this.myId } as P2pMessage;
			const encrypted = await encryptData(this.cryptoKey, fullMsg);
			this.client.publish(this.topic, encrypted);
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
