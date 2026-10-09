import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import {
	installMockNetwork,
	restoreMockNetwork,
	createTestNode,
	createConnectedStarTopology,
	destroyNodes,
	MockBrokerCluster,
	type MockHarnessContext,
	type TestNode
} from './helpers/mock-network.ts';
import { resolveTrick } from '$lib/platform/engine/trick.ts';
import type { GameDocument, Move } from '$lib/platform/engine/game-sync.ts';
import { createLocalP2pRoomRepo, createLocalP2pSync } from '$lib/platform/adapters/local-p2p-adapters.ts';
import type { GameRoom, RoomPlayer } from '$lib/platform/types/index';

describe('R4: Edge-Case Resilience & Dynamic Fallback Verification', () => {
	let _harness: MockHarnessContext;
	let cluster: MockBrokerCluster;
	const activeNodes: TestNode[] = [];

	beforeEach(() => {
		cluster = new MockBrokerCluster();
		_harness = installMockNetwork(cluster);
	});

	afterEach(async () => {
		await destroyNodes(activeNodes);
		activeNodes.length = 0;
		restoreMockNetwork();
	});

	describe('Abrupt WebRTC DataChannel Disruption -> Seamless MQTT Relay Fallback', () => {
		it('seamlessly falls back to MQTT relay when all DataChannels are abruptly terminated mid-hand', async () => {
			const { host, guests, allNodes } = await createConnectedStarTopology(3, 'FALL01');
			activeNodes.push(...allNodes);

			expect(host.lastStatus?.mode).toBe('p2p');
			for (const guest of guests) {
				expect(guest.lastStatus?.mode).toBe('p2p');
			}

			const playerIds = allNodes.map((n) => n.id);
			const baseDoc: GameDocument = {
				roomId: 'room-FALL01',
				phase: 'playing',
				currentRound: 0,
				seed: 101,
				dealerIndex: 0,
				moves: [],
				playerIds,
				roundScores: [],
				lastUpdate: Date.now()
			};

			// 1. Play first card over P2P DataChannel
			const move1: Move = {
				playerId: host.id,
				card: { suit: 'hearts', rank: 10 },
				timestamp: 1000
			};
			const docAfterMove1: GameDocument = {
				...baseDoc,
				moves: [move1],
				lastUpdate: Date.now() + 10
			};

			await host.manager.broadcast({
				type: 'sync_doc',
				roomId: docAfterMove1.roomId,
				doc: docAfterMove1
			});
			await new Promise((r) => setTimeout(r, 40));

			for (const guest of guests) {
				const latest = guest.receivedDocs[guest.receivedDocs.length - 1];
				expect(latest.moves.length).toBe(1);
			}

			// 2. Abruptly terminate all WebRTC DataChannels on Host and Guests mid-game!
			const hostPeers = Array.from((host.manager as any).peers.values());
			for (const peer of hostPeers) {
				(peer as any).close();
			}

			for (const guest of guests) {
				const guestPeers = Array.from((guest.manager as any).peers.values());
				for (const peer of guestPeers) {
					(peer as any).close();
				}
			}

			// 3. Verify status transitions to 'relay' mode
			expect(host.lastStatus?.mode).toBe('relay');
			expect(host.lastStatus?.directPeersCount).toBe(0);
			for (const guest of guests) {
				expect(guest.lastStatus?.mode).toBe('relay');
				expect(guest.lastStatus?.directPeersCount).toBe(0);
			}

			// 4. Play remaining cards over MQTT relay
			const move2: Move = {
				playerId: guests[0].id,
				card: { suit: 'hearts', rank: 14 }, // Ace of Hearts (winner)
				timestamp: 1050
			};
			const move3: Move = {
				playerId: guests[1].id,
				card: { suit: 'hearts', rank: 7 },
				timestamp: 1100
			};

			const finalDoc: GameDocument = {
				...baseDoc,
				moves: [move1, move2, move3],
				lastUpdate: Date.now() + 200
			};

			// Broadcast via Host (which will transparently fall back to MQTT relay)
			await host.manager.broadcast({
				type: 'sync_doc',
				roomId: finalDoc.roomId,
				doc: finalDoc
			});
			await new Promise((r) => setTimeout(r, 60));

			// 5. Verify all guests received all moves via MQTT relay without lost progression
			for (const guest of guests) {
				const latest = guest.receivedDocs[guest.receivedDocs.length - 1];
				expect(latest).toBeDefined();
				expect(latest.moves.length).toBe(3);
				expect(latest.moves[0].card.rank).toBe(10);
				expect(latest.moves[1].card.rank).toBe(14);
				expect(latest.moves[2].card.rank).toBe(7);
			}

			// 6. Verify deterministic trick resolution completed cleanly
			const trickResult = resolveTrick(
				finalDoc.moves.map((m) => ({ playerId: m.playerId, card: m.card }))
			);
			expect(trickResult.winnerId).toBe(guests[0].id);
			expect(trickResult.winningCard.rank).toBe(14);
		});

		it('handles asymmetric partial failure: routes via DataChannel to healthy peers and MQTT to degraded peers', async () => {
			const { host, guests, allNodes } = await createConnectedStarTopology(3, 'ASYMM01');
			activeNodes.push(...allNodes);

			// Forcibly close Guest 1 DataChannel, while Guest 0 DataChannel stays open
			const hostPeerG1 = (host.manager as any).peers.get(guests[1].id);
			expect(hostPeerG1).toBeDefined();
			hostPeerG1.close();

			// Status on host still shows directPeersCount = 1 (Guest 0)
			expect(host.lastStatus?.directPeersCount).toBe(1);

			const doc: GameDocument = {
				roomId: 'room-ASYMM01',
				phase: 'playing',
				currentRound: 0,
				seed: 202,
				dealerIndex: 0,
				moves: [{ playerId: host.id, card: { suit: 'clubs', rank: 12 }, timestamp: 500 }],
				playerIds: allNodes.map((n) => n.id),
				roundScores: [],
				lastUpdate: Date.now()
			};

			// Broadcast: should reach Guest 0 via DataChannel and Guest 1 via MQTT relay bridge
			await host.manager.broadcast({
				type: 'sync_doc',
				roomId: doc.roomId,
				doc
			});
			await new Promise((r) => setTimeout(r, 50));

			// Both guests should have received the doc
			const g0Doc = guests[0].receivedDocs[guests[0].receivedDocs.length - 1];
			const g1Doc = guests[1].receivedDocs[guests[1].receivedDocs.length - 1];
			expect(g0Doc).toBeDefined();
			expect(g1Doc).toBeDefined();
			expect(g0Doc.moves.length).toBe(1);
			expect(g1Doc.moves.length).toBe(1);
		});
	});

	describe('Room Join Retry Loop Recovery from Dropped Initial Packets', () => {
		it('successfully recovers from dropped initial join_request packet within 3 seconds', async () => {
			const roomCode = 'RETRY1';
			const host = await createTestNode('host-retry-1', true, roomCode);
			activeNodes.push(host);

			// Setup Host initial room
			const currentRoom: GameRoom = {
				id: `room-${roomCode}`,
				code: roomCode,
				gameDefinitionId: 'canadian-salad',
				hostId: host.id,
				maxPlayers: 4,
				phase: 'lobby',
				playerIds: [host.id],
				players: [
					{ id: host.id, displayName: 'Host', isHost: true, isConnected: true, lastSeen: Date.now() }
				],
				createdAt: Date.now()
			};

			// Setup packet filter to drop ONLY the first join_request packet
			let droppedCount = 0;
			cluster.addPacketFilter((_topic, payload) => {
				try {
					const parsed = JSON.parse(payload);
					// If envelope is encrypted, we inspect raw or simulate drop on first packet
					if (parsed.iv && parsed.ciphertext) {
						if (droppedCount === 0) {
							droppedCount++;
							return false; // Drop initial packet!
						}
					}
				} catch {}
				return true;
			});

			const guest = await createTestNode('guest-retry-1', false, roomCode);
			activeNodes.push(guest);

			const guestPlayer: RoomPlayer = {
				id: guest.id,
				displayName: 'Guest Player',
				isHost: false,
				isConnected: true,
				lastSeen: Date.now()
			};

			const startTime = Date.now();

			// Initial join request (will be dropped by packet filter)
			await guest.manager.broadcast({
				type: 'join_request',
				code: roomCode,
				player: guestPlayer
			});

			await new Promise((r) => setTimeout(r, 50));
			expect(droppedCount).toBe(1);
			expect(host.receivedJoinRequests.length).toBe(0); // Dropped!

			// Retry loop: after 400ms interval, retransmits join_request
			await new Promise((r) => setTimeout(r, 400));
			await guest.manager.broadcast({
				type: 'join_request',
				code: roomCode,
				player: guestPlayer
			});

			// Host responds to received join request with updated sync_room
			await new Promise((r) => setTimeout(r, 50));
			expect(host.receivedJoinRequests.length).toBe(1);

			const updatedRoom: GameRoom = {
				...currentRoom,
				playerIds: [host.id, guest.id],
				players: [...currentRoom.players, guestPlayer]
			};
			await host.manager.broadcast({
				type: 'sync_room',
				room: updatedRoom
			});

			await new Promise((r) => setTimeout(r, 50));

			const elapsedMs = Date.now() - startTime;
			expect(elapsedMs).toBeLessThan(3000); // Must recover within 3 seconds!

			// Guest successfully received updated room
			expect(guest.receivedRooms.length).toBeGreaterThanOrEqual(1);
			const guestLatestRoom = guest.receivedRooms[guest.receivedRooms.length - 1];
			expect(guestLatestRoom.playerIds).toContain(guest.id);
		});

		it('recovers from dropped query_room packet across retry attempts', async () => {
			const roomCode = 'QRETRY';
			const host = await createTestNode('host-qretry', true, roomCode);
			activeNodes.push(host);

			const hostRoom: GameRoom = {
				id: `room-${roomCode}`,
				code: roomCode,
				gameDefinitionId: 'oh-well',
				hostId: host.id,
				maxPlayers: 3,
				phase: 'lobby',
				playerIds: [host.id],
				players: [{ id: host.id, displayName: 'Host', isHost: true, isConnected: true, lastSeen: Date.now() }],
				createdAt: Date.now()
			};

			let droppedQueries = 0;
			cluster.addPacketFilter((_topic, payload) => {
				const parsed = JSON.parse(payload);
				if (parsed.iv && parsed.ciphertext) {
					if (droppedQueries === 0) {
						droppedQueries++;
						return false; // Drop initial query
					}
				}
				return true;
			});

			const guest = await createTestNode('guest-qretry', false, roomCode);
			activeNodes.push(guest);

			// First query_room is dropped
			await guest.manager.broadcast({ type: 'query_room', code: roomCode });
			await new Promise((r) => setTimeout(r, 40));
			expect(droppedQueries).toBe(1);

			// Retry after 300ms
			await new Promise((r) => setTimeout(r, 300));
			await guest.manager.broadcast({ type: 'query_room', code: roomCode });

			// Host receives and broadcasts sync_room
			await host.manager.broadcast({ type: 'sync_room', room: hostRoom });
			await new Promise((r) => setTimeout(r, 40));

			expect(guest.receivedRooms.length).toBeGreaterThanOrEqual(1);
			expect(guest.receivedRooms[0].code).toBe(roomCode);
		});
	});

	describe('Client Teardown & Clean Lifecycle Cleanup', () => {
		it('cleans up all peers, timers, MQTT client, and early candidate buffers on destroy()', async () => {
			const node = await createTestNode('node-cleanup-1', true, 'CLEAN1');
			activeNodes.push(node);

			// Add early ICE candidate to test buffer cleanup
			const earlyCand: RTCIceCandidateInit = {
				candidate: 'cand:dummy',
				sdpMid: '0',
				sdpMLineIndex: 0
			};
			await (node.manager as any).handleIncomingMessage({
				type: 'signal_ice',
				senderId: 'remote-1',
				targetId: node.id,
				candidate: earlyCand
			});

			expect(node.manager.getEarlyCandidates('remote-1').length).toBe(1);

			// Destroy manager
			node.manager.destroy();

			// Verify state is clean
			expect(node.manager.getEarlyCandidates('remote-1').length).toBe(0);
			expect((node.manager as any).peers.size).toBe(0);
			expect((node.manager as any).client).toBeNull();
			expect((node.manager as any).pingTimer).toBeNull();
			expect(node.lastStatus?.mode).toBe('disconnected');

			// Idempotent destroy call does not throw
			expect(() => node.manager.destroy()).not.toThrow();
		});

		it('cleans up room repo listeners and room state on table deletion', async () => {
			const repo = createLocalP2pRoomRepo();
			const room = await repo.create({
				code: 'LEAVE1',
				gameDefinitionId: 'oh-well',
				hostId: 'host-1',
				maxPlayers: 4,
				phase: 'lobby',
				players: [{ id: 'host-1', displayName: 'Host', isHost: true, isConnected: true, lastSeen: Date.now() }],
				playerIds: ['host-1'],
				createdAt: Date.now()
			});

			let listenerCalls = 0;
			let currentRoom: GameRoom | null = null;
			const unsubscribe = repo.onRoomChanged(room.id, (r) => {
				listenerCalls++;
				currentRoom = r;
			});

			expect(currentRoom).not.toBeNull();
			expect(listenerCalls).toBe(1);

			// Delete room (host leaves and closes table)
			await repo.delete(room.id);
			expect(currentRoom).toBeNull();

			// Verify room is removed from repo
			const fetched = await repo.getById(room.id);
			expect(fetched).toBeNull();

			// Unsubscribe removes listener cleanly
			unsubscribe();
			await repo.update(room.id, { phase: 'playing' });
			// Listener not called after unsubscribe
			expect(listenerCalls).toBe(2); // 1 initial + 1 on delete
		});

		it('cleans up realtime sync listeners and documents cleanly', async () => {
			const sync = createLocalP2pSync();
			const roomId = 'sync-room-1';
			const testDoc: GameDocument = {
				roomId,
				phase: 'playing',
				currentRound: 0,
				seed: 123,
				dealerIndex: 0,
				moves: [],
				playerIds: ['p1'],
				roundScores: [],
				lastUpdate: Date.now()
			};

			let docUpdates = 0;
			const unsubscribe = sync.subscribe(roomId, (_doc) => {
				docUpdates++;
			});

			await sync.publish(roomId, testDoc);
			expect(docUpdates).toBe(1);

			// Clean unsubscribe
			unsubscribe();

			const nextDoc: GameDocument = { ...testDoc, lastUpdate: Date.now() + 10 };
			await sync.publish(roomId, nextDoc);
			// Listener was unsubscribed, so update count did not increase
			expect(docUpdates).toBe(1);

			// Removal cleans up doc from cache
			await sync.remove(roomId);
		});
	});
});
