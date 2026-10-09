import { EventEmitter } from 'node:events';
import mqtt, { type MqttClient } from 'mqtt';
import {
	P2pNetworkManager,
	BROKER_URLS,
	deriveRoomKey,
	encryptData,
	type P2pMessage,
	type NetworkStatusInfo
} from '$lib/platform/adapters/p2p-webrtc.ts';
import type { GameRoom, RoomPlayer } from '$lib/platform/types/index';
import type { GameDocument } from '$lib/platform/engine/index';

// --- MOCK MQTT HARNESS ---

export type BrokerStatus = 'online' | 'error' | 'timeout' | 'offline';

export interface ConnectAttempt {
	readonly brokerUrl: string;
	readonly clientId: string;
	readonly timestamp: number;
}

export interface PublishedMessage {
	readonly brokerUrl: string;
	readonly topic: string;
	readonly payload: string;
	readonly senderClientId: string;
	readonly timestamp: number;
}

export type PacketFilter = (
	topic: string,
	payload: string,
	senderClientId: string
) => boolean | Promise<boolean>;

export class MockBrokerCluster {
	private brokerStatuses = new Map<string, BrokerStatus>();
	private clientSubscriptions = new Map<string, Set<MockMqttClient>>();
	private connectedClients = new Map<string, Set<MockMqttClient>>();
	public readonly connectAttempts: ConnectAttempt[] = [];
	public readonly publishedMessages: PublishedMessage[] = [];
	private packetFilters: PacketFilter[] = [];

	constructor() {
		for (const url of BROKER_URLS) {
			this.brokerStatuses.set(url, 'online');
			this.connectedClients.set(url, new Set());
		}
	}

	public setBrokerStatus(brokerUrl: string, status: BrokerStatus): void {
		this.brokerStatuses.set(brokerUrl, status);
		if (status === 'offline' || status === 'error') {
			this.dropBroker(brokerUrl, status === 'error');
		}
	}

	public getBrokerStatus(brokerUrl: string): BrokerStatus {
		return this.brokerStatuses.get(brokerUrl) ?? 'online';
	}

	public addPacketFilter(filter: PacketFilter): void {
		this.packetFilters.push(filter);
	}

	public clearPacketFilters(): void {
		this.packetFilters = [];
	}

	public dropBroker(brokerUrl: string, withError = false): void {
		const clients = this.connectedClients.get(brokerUrl);
		if (clients) {
			const clientList = Array.from(clients);
			for (const client of clientList) {
				client.simulateDisconnect(withError);
			}
		}
	}

	public registerClient(brokerUrl: string, client: MockMqttClient): void {
		let set = this.connectedClients.get(brokerUrl);
		if (!set) {
			set = new Set();
			this.connectedClients.set(brokerUrl, set);
		}
		set.add(client);
	}

	public unregisterClient(brokerUrl: string, client: MockMqttClient): void {
		const set = this.connectedClients.get(brokerUrl);
		set?.delete(client);

		for (const [, subscribers] of this.clientSubscriptions) {
			subscribers.delete(client);
		}
	}

	public subscribe(topic: string, client: MockMqttClient): void {
		let subs = this.clientSubscriptions.get(topic);
		if (!subs) {
			subs = new Set();
			this.clientSubscriptions.set(topic, subs);
		}
		subs.add(client);
	}

	public unsubscribe(topic: string, client: MockMqttClient): void {
		const subs = this.clientSubscriptions.get(topic);
		subs?.delete(client);
	}

	public async publish(
		brokerUrl: string,
		topic: string,
		payload: string | Buffer,
		sender: MockMqttClient
	): Promise<void> {
		const strPayload = typeof payload === 'string' ? payload : payload.toString('utf-8');
		this.publishedMessages.push({
			brokerUrl,
			topic,
			payload: strPayload,
			senderClientId: sender.clientId,
			timestamp: Date.now()
		});

		for (const filter of this.packetFilters) {
			const shouldAllow = await filter(topic, strPayload, sender.clientId);
			if (!shouldAllow) {
				return; // Packet dropped by fault-injection filter
			}
		}

		const subs = this.clientSubscriptions.get(topic);
		if (!subs) return;

		for (const subscriber of subs) {
			// Don't deliver to disconnected clients
			if (subscriber !== sender && subscriber.connected) {
				// Queue microtask to simulate async message delivery
				queueMicrotask(() => {
					if (subscriber.connected) {
						subscriber.emit('message', topic, Buffer.from(strPayload));
					}
				});
			}
		}
	}

	public reset(): void {
		for (const url of BROKER_URLS) {
			this.brokerStatuses.set(url, 'online');
		}
		this.connectAttempts.length = 0;
		this.publishedMessages.length = 0;
		this.packetFilters = [];
		this.clientSubscriptions.clear();
		this.connectedClients.clear();
	}
}

export class MockMqttClient extends EventEmitter {
	public connected = false;
	public readonly brokerUrl: string;
	public readonly clientId: string;
	private cluster: MockBrokerCluster;
	private isEnded = false;

	constructor(brokerUrl: string, opts: { clientId?: string }, cluster: MockBrokerCluster) {
		super();
		this.brokerUrl = brokerUrl;
		this.clientId = opts.clientId ?? `mock_${Math.random().toString(36).slice(2, 7)}`;
		this.cluster = cluster;

		this.cluster.connectAttempts.push({
			brokerUrl,
			clientId: this.clientId,
			timestamp: Date.now()
		});

		const status = this.cluster.getBrokerStatus(brokerUrl);
		if (status === 'timeout') {
			// Do not emit connect or error - let the caller's timeout handle it
			return;
		}

		if (status === 'error' || status === 'offline') {
			queueMicrotask(() => {
				if (!this.isEnded) {
					this.emit('error', new Error(`Connection refused by broker ${brokerUrl}`));
				}
			});
			return;
		}

		// 'online' status -> connect successfully
		queueMicrotask(() => {
			if (!this.isEnded) {
				this.connected = true;
				this.cluster.registerClient(brokerUrl, this);
				this.emit('connect');
			}
		});
	}

	public subscribe(
		topic: string | string[],
		callback?: (err: Error | null) => void
	): this {
		if (this.isEnded) {
			callback?.(new Error('Client ended'));
			return this;
		}
		const topics = Array.isArray(topic) ? topic : [topic];
		for (const t of topics) {
			this.cluster.subscribe(t, this);
		}
		queueMicrotask(() => {
			callback?.(null);
		});
		return this;
	}

	public unsubscribe(
		topic: string | string[],
		callback?: (err: Error | null) => void
	): this {
		const topics = Array.isArray(topic) ? topic : [topic];
		for (const t of topics) {
			this.cluster.unsubscribe(t, this);
		}
		callback?.(null);
		return this;
	}

	public publish(
		topic: string,
		message: string | Buffer,
		callback?: (err: Error | null) => void
	): this {
		if (!this.connected || this.isEnded) {
			callback?.(new Error('Client not connected'));
			return this;
		}
		void this.cluster.publish(this.brokerUrl, topic, message, this).then(() => {
			callback?.(null);
		});
		return this;
	}

	public end(force = false, _opts?: unknown, callback?: () => void): this {
		void force;
		if (this.isEnded) {
			callback?.();
			return this;
		}
		this.isEnded = true;
		this.connected = false;
		this.cluster.unregisterClient(this.brokerUrl, this);
		this.emit('close');
		callback?.();
		return this;
	}

	public simulateDisconnect(withError = false): void {
		if (!this.connected) return;
		this.connected = false;
		this.cluster.unregisterClient(this.brokerUrl, this);
		if (withError) {
			this.emit('error', new Error('Simulated socket error / connection lost'));
		}
		this.emit('close');
	}
}

// --- MOCK WEBRTC HARNESS ---

export class MockRTCDataChannel extends EventEmitter {
	public readyState: RTCDataChannelState = 'connecting';
	public pairedChannel: MockRTCDataChannel | null = null;
	public onopen: ((ev: unknown) => void) | null = null;
	public onclose: ((ev: unknown) => void) | null = null;
	public onerror: ((ev: unknown) => void) | null = null;
	public onmessage: ((ev: { data: unknown }) => void) | null = null;

	constructor(
		public readonly label: string,
		public readonly options?: RTCDataChannelInit
	) {
		super();
	}

	public setPaired(other: MockRTCDataChannel): void {
		this.pairedChannel = other;
		other.pairedChannel = this;
	}

	public markOpen(): void {
		this.readyState = 'open';
		queueMicrotask(() => {
			this.onopen?.({});
			this.emit('open', {});
		});
	}

	public send(data: string | Blob | ArrayBuffer | ArrayBufferView): void {
		if (this.readyState !== 'open') {
			throw new Error('DataChannel is not open');
		}
		if (this.pairedChannel && this.pairedChannel.readyState === 'open') {
			const target = this.pairedChannel;
			queueMicrotask(() => {
				target.onmessage?.({ data });
				target.emit('message', { data });
			});
		}
	}

	public close(): void {
		if (this.readyState === 'closed') return;
		this.readyState = 'closed';
		this.onclose?.({});
		this.emit('close', {});

		if (this.pairedChannel && this.pairedChannel.readyState !== 'closed') {
			const other = this.pairedChannel;
			other.readyState = 'closed';
			other.onclose?.({});
			other.emit('close', {});
		}
	}

	public simulateError(err?: Error): void {
		this.onerror?.({ error: err ?? new Error('DataChannel error') });
		this.emit('error', { error: err ?? new Error('DataChannel error') });
	}

	public simulateAbruptDrop(): void {
		this.readyState = 'closed';
		this.onerror?.({ error: new Error('Abrupt DataChannel termination') });
		this.onclose?.({});
		this.emit('close', {});

		if (this.pairedChannel) {
			this.pairedChannel.readyState = 'closed';
			this.pairedChannel.onerror?.({ error: new Error('Remote channel dropped') });
			this.pairedChannel.onclose?.({});
			this.pairedChannel.emit('close', {});
		}
	}
}

export class MockRTCSessionDescription {
	readonly type: RTCSdpType;
	readonly sdp: string;

	constructor(descriptionInitDict: RTCSessionDescriptionInit) {
		this.type = descriptionInitDict.type;
		this.sdp = descriptionInitDict.sdp ?? '';
	}

	public toJSON(): RTCSessionDescriptionInit {
		return { type: this.type, sdp: this.sdp };
	}
}

export class MockRTCIceCandidate {
	readonly candidate: string;
	readonly sdpMid: string | null;
	readonly sdpMLineIndex: number | null;
	readonly usernameFragment: string | null;

	constructor(candidateInitDict: RTCIceCandidateInit) {
		this.candidate = candidateInitDict.candidate ?? '';
		this.sdpMid = candidateInitDict.sdpMid ?? null;
		this.sdpMLineIndex = candidateInitDict.sdpMLineIndex ?? null;
		this.usernameFragment = candidateInitDict.usernameFragment ?? null;
	}

	public toJSON(): RTCIceCandidateInit {
		return {
			candidate: this.candidate,
			sdpMid: this.sdpMid,
			sdpMLineIndex: this.sdpMLineIndex,
			usernameFragment: this.usernameFragment
		};
	}
}

let peerConnectionCounter = 0;

export class MockRTCPeerConnection extends EventEmitter {
	public static readonly registry = new Map<string, MockRTCPeerConnection>();
	public static simulateIceFailure = false;

	public readonly id: string;
	public connectionState: RTCPeerConnectionState = 'new';
	public localDescription: RTCSessionDescription | null = null;
	public remoteDescription: RTCSessionDescription | null = null;
	public readonly dataChannels: MockRTCDataChannel[] = [];
	public readonly addedIceCandidates: RTCIceCandidateInit[] = [];

	public onicecandidate: ((ev: { candidate: MockRTCIceCandidate | null }) => void) | null = null;
	public ondatachannel: ((ev: { channel: RTCDataChannel }) => void) | null = null;
	public onconnectionstatechange: (() => void) | null = null;

	constructor(public readonly configuration?: RTCConfiguration) {
		super();
		this.id = `mock_pc_${++peerConnectionCounter}_${Math.random().toString(36).slice(2, 6)}`;
		MockRTCPeerConnection.registry.set(this.id, this);
	}

	public createDataChannel(label: string, options?: RTCDataChannelInit): RTCDataChannel {
		const dc = new MockRTCDataChannel(label, options);
		this.dataChannels.push(dc);
		return dc as unknown as RTCDataChannel;
	}

	public async createOffer(): Promise<RTCSessionDescriptionInit> {
		const sdp = `v=0\no=- ${this.id} 2 IN IP4 127.0.0.1\ns=-\nt=0 0\na=fingerprint:sha-256 test\nm=application 9 DTLS/SCTP 5000\nc=IN IP4 127.0.0.1`;
		return { type: 'offer', sdp };
	}

	public async setLocalDescription(desc: RTCSessionDescriptionInit): Promise<void> {
		this.localDescription = new MockRTCSessionDescription(desc) as unknown as RTCSessionDescription;
		// Emit mock ICE candidate
		queueMicrotask(() => {
			if (this.onicecandidate && this.connectionState !== 'closed') {
				this.onicecandidate({
					candidate: new MockRTCIceCandidate({
						candidate: `candidate:1 1 UDP 2122260223 127.0.0.1 5000${this.id.length} typ host`,
						sdpMid: '0',
						sdpMLineIndex: 0
					})
				});
			}
		});
	}

	public async setRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void> {
		this.remoteDescription = new MockRTCSessionDescription(desc) as unknown as RTCSessionDescription;

		// Extract remote PC ID from SDP
		const match = desc.sdp?.match(/o=- (mock_pc_[a-zA-Z0-9_]+)/);
		if (match) {
			const remoteId = match[1];
			const remotePc = MockRTCPeerConnection.registry.get(remoteId);
			if (remotePc) {
				if (desc.type === 'offer') {
					// We are the answering side (Host). Create paired data channels for remote's channels.
					for (const remoteDc of remotePc.dataChannels) {
						if (!remoteDc.pairedChannel) {
							const localDc = new MockRTCDataChannel(remoteDc.label, remoteDc.options);
							this.dataChannels.push(localDc);
							localDc.setPaired(remoteDc);
							queueMicrotask(() => {
								this.ondatachannel?.({ channel: localDc as unknown as RTCDataChannel });
							});
						}
					}
				} else if (desc.type === 'answer') {
					// We are the offering side. The handshake is complete!
					this.connectionState = 'connected';
					remotePc.connectionState = 'connected';
					this.onconnectionstatechange?.();
					remotePc.onconnectionstatechange?.();

					// Open all paired data channels
					for (const dc of this.dataChannels) {
						if (dc.pairedChannel) {
							dc.markOpen();
							dc.pairedChannel.markOpen();
						}
					}
				}
			}
		}
	}

	public async createAnswer(): Promise<RTCSessionDescriptionInit> {
		const sdp = `v=0\no=- ${this.id} 2 IN IP4 127.0.0.1\ns=-\nt=0 0\na=fingerprint:sha-256 test\nm=application 9 DTLS/SCTP 5000\nc=IN IP4 127.0.0.1`;
		return { type: 'answer', sdp };
	}

	public async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
		if (MockRTCPeerConnection.simulateIceFailure) {
			throw new Error('Simulated ICE candidate addition failure');
		}
		this.addedIceCandidates.push(candidate);
	}

	public close(): void {
		if (this.connectionState === 'closed') return;
		this.connectionState = 'closed';
		for (const dc of this.dataChannels) {
			dc.close();
		}
		this.onconnectionstatechange?.();
		MockRTCPeerConnection.registry.delete(this.id);
	}

	public simulateDisconnect(): void {
		this.connectionState = 'failed';
		this.onconnectionstatechange?.();
	}
}

// --- GLOBAL INSTALL & RESTORE ---

let originalMqttConnect: typeof mqtt.connect | null = null;
let originalRTCPeerConnection: unknown = undefined;
let originalRTCSessionDescription: unknown = undefined;
let originalRTCIceCandidate: unknown = undefined;

export interface MockHarnessContext {
	readonly cluster: MockBrokerCluster;
	restore: () => void;
}

export function installMockNetwork(existingCluster?: MockBrokerCluster): MockHarnessContext {
	const cluster = existingCluster ?? new MockBrokerCluster();

	// Intercept mqtt.connect
	if (!originalMqttConnect) {
		originalMqttConnect = mqtt.connect;
	}
	mqtt.connect = ((brokerUrl: string, opts: unknown) => {
		return new MockMqttClient(brokerUrl, (opts ?? {}) as { clientId?: string }, cluster) as unknown as MqttClient;
	}) as typeof mqtt.connect;

	// Polyfill WebRTC globals
	const g = globalThis as unknown as Record<string, unknown>;
	originalRTCPeerConnection = g.RTCPeerConnection;
	originalRTCSessionDescription = g.RTCSessionDescription;
	originalRTCIceCandidate = g.RTCIceCandidate;

	g.RTCPeerConnection = MockRTCPeerConnection;
	g.RTCSessionDescription = MockRTCSessionDescription;
	g.RTCIceCandidate = MockRTCIceCandidate;

	return {
		cluster,
		restore: () => {
			restoreMockNetwork();
		}
	};
}

export function restoreMockNetwork(): void {
	if (originalMqttConnect) {
		mqtt.connect = originalMqttConnect;
		originalMqttConnect = null;
	}

	const g = globalThis as unknown as Record<string, unknown>;
	if (originalRTCPeerConnection !== undefined) {
		g.RTCPeerConnection = originalRTCPeerConnection;
	} else {
		delete g.RTCPeerConnection;
	}
	if (originalRTCSessionDescription !== undefined) {
		g.RTCSessionDescription = originalRTCSessionDescription;
	} else {
		delete g.RTCSessionDescription;
	}
	if (originalRTCIceCandidate !== undefined) {
		g.RTCIceCandidate = originalRTCIceCandidate;
	} else {
		delete g.RTCIceCandidate;
	}

	MockRTCPeerConnection.registry.clear();
	MockRTCPeerConnection.simulateIceFailure = false;
}

// --- TOPOLOGY & NODE HELPERS ---

export interface TestNode {
	readonly id: string;
	readonly isHost: boolean;
	readonly manager: P2pNetworkManager;
	readonly receivedRooms: GameRoom[];
	readonly receivedDocs: GameDocument[];
	readonly receivedJoinRequests: { code: string; player: RoomPlayer }[];
	readonly statuses: NetworkStatusInfo[];
	lastStatus?: NetworkStatusInfo;
}

export async function createTestNode(
	id: string,
	isHost: boolean,
	roomCode: string
): Promise<TestNode> {
	const receivedRooms: GameRoom[] = [];
	const receivedDocs: GameDocument[] = [];
	const receivedJoinRequests: { code: string; player: RoomPlayer }[] = [];
	const statuses: NetworkStatusInfo[] = [];

	const node: TestNode = {
		id,
		isHost,
		receivedRooms,
		receivedDocs,
		receivedJoinRequests,
		statuses,
		manager: null as unknown as P2pNetworkManager
	};

	const manager = new P2pNetworkManager({
		onRoomMessage: (room) => {
			receivedRooms.push(room);
		},
		onDocMessage: (_roomId, doc) => {
			receivedDocs.push(doc);
		},
		onJoinRequest: (code, player) => {
			receivedJoinRequests.push({ code, player });
		},
		onStatusChange: (status) => {
			statuses.push(status);
			node.lastStatus = status;
		}
	});

	(node as { manager: P2pNetworkManager }).manager = manager;

	await manager.connect(roomCode, id, isHost);
	return node;
}

/**
 * Creates and sets up a Host-Star topology with 1 Host and (playerCount - 1) Guests.
 * Handshakes both over MQTT signaling and establishes WebRTC DataChannels.
 */
export async function createConnectedStarTopology(
	playerCount: number,
	roomCode = 'STAR01'
): Promise<{ host: TestNode; guests: TestNode[]; allNodes: TestNode[] }> {
	const host = await createTestNode('host-1', true, roomCode);
	const guests: TestNode[] = [];

	for (let i = 1; i < playerCount; i++) {
		const guest = await createTestNode(`guest-${i}`, false, roomCode);
		guests.push(guest);
	}

	const allNodes = [host, ...guests];

	// Initial room sync broadcast from Host
	const initialRoom: GameRoom = {
		id: `room-${roomCode}`,
		code: roomCode,
		gameDefinitionId: 'oh-well',
		hostId: host.id,
		maxPlayers: playerCount,
		phase: 'lobby',
		playerIds: allNodes.map((n) => n.id),
		players: allNodes.map((n) => ({
			id: n.id,
			displayName: n.id,
			isHost: n.isHost,
			isConnected: true,
			lastSeen: Date.now()
		})),
		createdAt: Date.now()
	};

	// 1. Host broadcasts room sync
	await host.manager.broadcast({ type: 'sync_room', room: initialRoom });

	// Allow microtasks for room receipt and offer generation
	await new Promise((r) => setTimeout(r, 50));

	// 2. Each guest initiates WebRTC connection to host
	for (const guest of guests) {
		await guest.manager.initiateWebRtcToHost(host.id);
	}

	// Allow microtasks for offer/answer exchange and datachannel opening
	await new Promise((r) => setTimeout(r, 80));

	return { host, guests, allNodes };
}

export async function destroyNodes(nodes: readonly TestNode[]): Promise<void> {
	for (const node of nodes) {
		node.manager.destroy();
	}
	await new Promise((r) => setTimeout(r, 20));
}

// --- ENVELOPE TAMPERING TEST HELPERS ---

export async function createCorruptedCiphertextEnvelope(
	code: string,
	payload: P2pMessage
): Promise<string> {
	const key = await deriveRoomKey(code);
	const raw = await encryptData(key, payload);
	const parsed = JSON.parse(raw);
	// Corrupt first byte of ciphertext
	parsed.ciphertext[0] = (parsed.ciphertext[0] + 1) % 256;
	return JSON.stringify(parsed);
}

export async function createBadIvEnvelope(
	code: string,
	payload: P2pMessage,
	badIvLength = 8
): Promise<string> {
	const key = await deriveRoomKey(code);
	const raw = await encryptData(key, payload);
	const parsed = JSON.parse(raw);
	parsed.iv = parsed.iv.slice(0, badIvLength);
	return JSON.stringify(parsed);
}

export async function createWrongKeyEnvelope(
	correctCode: string,
	wrongCode: string,
	payload: P2pMessage
): Promise<string> {
	void correctCode;
	const wrongKey = await deriveRoomKey(wrongCode);
	return encryptData(wrongKey, payload);
}
