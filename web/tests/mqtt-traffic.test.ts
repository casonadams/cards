import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import {
	P2pNetworkManager,
	RECONNECT_MAX_DELAY_MS,
	reconnectDelayMs
} from '$lib/platform/adapters/p2p-webrtc.ts';
import { diffDoc } from '$lib/platform/engine/doc-delta.ts';
import type { GameDocument } from '$lib/platform/engine/game-sync.ts';
import {
	installMockNetwork,
	restoreMockNetwork,
	createConnectedStarTopology,
	destroyNodes,
	MockBrokerCluster,
	type TestNode
} from './helpers/mock-network.ts';

const settle = (ms = 60) => new Promise((r) => setTimeout(r, ms));

function closeHostChannelTo(host: TestNode, guest: TestNode): void {
	(host.manager as unknown as { peers: Map<string, { close(): void }> }).peers.get(guest.id)?.close();
}

function docWithMoves(roomId: string, playerIds: readonly string[], count: number): GameDocument {
	return {
		roomId,
		phase: 'playing',
		currentRound: 0,
		seed: 7,
		dealerIndex: 0,
		moves: Array.from({ length: count }, (_, i) => ({
			playerId: playerIds[i % playerIds.length],
			card: { suit: 'hearts', rank: 2 + i },
			timestamp: 1000 + i
		})),
		playerIds: [...playerIds],
		roundScores: [],
		lastUpdate: 1000 + count
	};
}

describe('reconnectDelayMs', () => {
	it.each([
		[0, 1, 0],
		[1, 1, 1000],
		[2, 1, 2000],
		[3, 1, 4000],
		[1, 0, 750],
		[20, 1, RECONNECT_MAX_DELAY_MS]
	])('attempt %i with jitter %d waits %ims', (attempt, jitter, expected) => {
		expect(reconnectDelayMs(attempt, jitter)).toBe(expected);
	});
});

describe('MQTT relay traffic', () => {
	let cluster: MockBrokerCluster;
	const activeNodes: TestNode[] = [];

	beforeEach(() => {
		cluster = new MockBrokerCluster();
		installMockNetwork(cluster);
	});

	afterEach(async () => {
		await destroyNodes(activeNodes);
		activeNodes.length = 0;
		restoreMockNetwork();
	});

	it('host updates skip the broker when every room member has an open DataChannel', async () => {
		const { host, guests, allNodes } = await createConnectedStarTopology(3, 'QUIET1');
		activeNodes.push(...allNodes);
		const publishedBefore = cluster.publishedMessages.length;

		await host.manager.broadcast({
			type: 'sync_doc',
			roomId: 'room-QUIET1',
			doc: docWithMoves('room-QUIET1', allNodes.map((n) => n.id), 1)
		});
		await settle();

		expect(cluster.publishedMessages.length).toBe(publishedBefore);
		for (const guest of guests) {
			expect(guest.receivedDocs.at(-1)?.moves.length).toBe(1);
		}
	});

	it('host updates use the broker when a room member has no open DataChannel', async () => {
		const { host, guests, allNodes } = await createConnectedStarTopology(3, 'QUIET2');
		activeNodes.push(...allNodes);
		closeHostChannelTo(host, guests[1]);
		const publishedBefore = cluster.publishedMessages.length;

		await host.manager.broadcast({
			type: 'sync_doc',
			roomId: 'room-QUIET2',
			doc: docWithMoves('room-QUIET2', allNodes.map((n) => n.id), 2)
		});
		await settle();

		expect(cluster.publishedMessages.length).toBe(publishedBefore + 1);
		expect(guests[1].receivedDocs.at(-1)?.moves.length).toBe(2);
	});

	it('a guest move travels host-relayed over DataChannels without touching the broker', async () => {
		const { guests, allNodes } = await createConnectedStarTopology(3, 'QUIET3');
		activeNodes.push(...allNodes);
		const publishedBefore = cluster.publishedMessages.length;

		await guests[0].manager.broadcast({
			type: 'sync_doc',
			roomId: 'room-QUIET3',
			doc: docWithMoves('room-QUIET3', allNodes.map((n) => n.id), 3)
		});
		await settle();

		expect(cluster.publishedMessages.length).toBe(publishedBefore);
		expect(guests[1].receivedDocs.at(-1)?.moves.length).toBe(3);
	});

	it('a guest move is bridged to the broker once by the host for a guest without a DataChannel', async () => {
		const { host, guests, allNodes } = await createConnectedStarTopology(3, 'QUIET5');
		activeNodes.push(...allNodes);
		closeHostChannelTo(host, guests[1]);
		await settle();
		const publishedBefore = cluster.publishedMessages.length;

		await guests[0].manager.broadcast({
			type: 'sync_doc',
			roomId: 'room-QUIET5',
			doc: docWithMoves('room-QUIET5', allNodes.map((n) => n.id), 4)
		});
		await settle();

		expect(cluster.publishedMessages.length).toBe(publishedBefore + 1);
		expect(guests[1].receivedDocs.at(-1)?.moves.length).toBe(4);
	});

	it('closing a room still reaches guests that were members without a DataChannel', async () => {
		const { host, guests, allNodes } = await createConnectedStarTopology(3, 'QUIET4');
		activeNodes.push(...allNodes);
		closeHostChannelTo(host, guests[0]);
		const closedRoom = { ...guests[0].receivedRooms[0], phase: 'gameOver' as const, players: [] };

		await host.manager.broadcast({ type: 'sync_room', room: closedRoom });
		await settle();

		expect(guests[0].receivedRooms.at(-1)?.players.length).toBe(0);
	});

	it('a superseded connect() leaves only the latest room subscription connected', async () => {
		const manager = new P2pNetworkManager({});
		const first = manager.connect('OLDRM1', 'switcher', false);
		const second = manager.connect('NEWRM1', 'switcher', false);
		await Promise.all([first, second]);
		await settle();

		const client = (manager as unknown as { client: { connected: boolean } | null }).client;
		const connected = client?.connected;
		const attempts = cluster.connectAttempts.length;
		manager.destroy();

		expect(connected).toBe(true);
		expect(attempts).toBe(1);
	});

	it('delivers doc deltas to every guest without the broker', async () => {
		const { host, guests, allNodes } = await createConnectedStarTopology(3, 'DELTA1');
		activeNodes.push(...allNodes);
		const ids = allNodes.map((n) => n.id);
		const delta = diffDoc(docWithMoves('room-DELTA1', ids, 5), docWithMoves('room-DELTA1', ids, 6))!;
		const publishedBefore = cluster.publishedMessages.length;

		await host.manager.broadcast({ type: 'doc_delta', delta });
		await settle();

		expect(cluster.publishedMessages.length).toBe(publishedBefore);
		for (const guest of guests) {
			expect(guest.receivedDeltas.at(-1)).toEqual(delta);
		}
	});
});

describe('WebRTC peer recovery', () => {
	let cluster: MockBrokerCluster;
	const activeNodes: TestNode[] = [];

	beforeEach(() => {
		cluster = new MockBrokerCluster();
		installMockNetwork(cluster);
	});

	afterEach(async () => {
		await destroyNodes(activeNodes);
		activeNodes.length = 0;
		restoreMockNetwork();
	});

	it('drops a closed DataChannel peer and reconnects the guest to the host', async () => {
		const { host, guests, allNodes } = await createConnectedStarTopology(2, 'HEAL01');
		activeNodes.push(...allNodes);
		const peersOf = (node: TestNode) =>
			(node.manager as unknown as { peers: Map<string, { isOpen: boolean; close(): void }> }).peers;
		const original = peersOf(host).get(guests[0].id);

		original?.close();
		await settle();
		expect(peersOf(guests[0]).has(host.id)).toBe(false);

		await settle(2200);
		expect(peersOf(guests[0]).get(host.id)?.isOpen).toBe(true);
		expect(peersOf(host).get(guests[0].id)).not.toBe(original);
		expect(peersOf(host).get(guests[0].id)?.isOpen).toBe(true);
	});
});
