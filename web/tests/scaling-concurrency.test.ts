import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import {
	installMockNetwork,
	restoreMockNetwork,
	createConnectedStarTopology,
	destroyNodes,
	MockBrokerCluster,
	type MockHarnessContext,
	type TestNode
} from './helpers/mock-network.ts';
import { resolveTrick, type TrickPlay } from '$lib/platform/engine/trick.ts';
import type { GameDocument, Move } from '$lib/platform/engine/game-sync.ts';
import type { Card } from '$lib/platform/types/index';

describe('R2: Concurrency & Scaling Tests', () => {
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

	describe('Host-Star WebRTC Topology Scaling (2 to 7 Players)', () => {
		for (const playerCount of [2, 3, 4, 5, 6, 7]) {
			it(`successfully scales Host-Star topology to ${playerCount} players with direct DataChannels`, async () => {
				const { host, guests, allNodes } = await createConnectedStarTopology(
					playerCount,
					`SCALE${playerCount}`
				);
				activeNodes.push(...allNodes);

				// Verify Host status
				expect(host.lastStatus?.mode).toBe('p2p');
				expect(host.lastStatus?.directPeersCount).toBe(playerCount - 1);

				// Verify each Guest status
				for (const guest of guests) {
					expect(guest.lastStatus?.mode).toBe('p2p');
					expect(guest.lastStatus?.directPeersCount).toBe(1);
				}

				// Verify room message was received by all guests
				for (const guest of guests) {
					expect(guest.receivedRooms.length).toBeGreaterThanOrEqual(1);
					expect(guest.receivedRooms[0].hostId).toBe(host.id);
					expect(guest.receivedRooms[0].playerIds.length).toBe(playerCount);
				}
			});
		}
	});

	describe('Concurrent Card Submissions & Deterministic Trick Resolution', () => {
		it('handles concurrent card submissions at a 4-player table with deterministic trick resolution', async () => {
			const { host, guests, allNodes } = await createConnectedStarTopology(4, 'TRICK4');
			activeNodes.push(...allNodes);

			const playerIds = allNodes.map((n) => n.id);
			const baseDoc: GameDocument = {
				roomId: 'room-TRICK4',
				phase: 'playing',
				currentRound: 0,
				seed: 42,
				dealerIndex: 0,
				moves: [],
				playerIds,
				roundScores: [],
				lastUpdate: Date.now()
			};

			// Broadcast initial game document
			await host.manager.broadcast({
				type: 'sync_doc',
				roomId: baseDoc.roomId,
				doc: baseDoc
			});
			await new Promise((r) => setTimeout(r, 40));

			// 4 players concurrently play their cards
			const cardPlays: { playerId: string; card: Card }[] = [
				{ playerId: host.id, card: { suit: 'hearts', rank: 9 } },
				{ playerId: guests[0].id, card: { suit: 'hearts', rank: 14 } }, // Ace of Hearts - Highest
				{ playerId: guests[1].id, card: { suit: 'hearts', rank: 7 } },
				{ playerId: guests[2].id, card: { suit: 'spades', rank: 13 } } // Off-suit King
			];

			// Simulate simultaneous submissions arriving at Host
			const updatedMoves: Move[] = cardPlays.map((p, idx) => ({
				playerId: p.playerId,
				card: p.card,
				timestamp: 1000 + idx * 10
			}));

			const finalDoc: GameDocument = {
				...baseDoc,
				moves: updatedMoves,
				lastUpdate: Date.now() + 500
			};

			// Host synchronizes resolved document to all peers
			await host.manager.broadcast({
				type: 'sync_doc',
				roomId: finalDoc.roomId,
				doc: finalDoc
			});
			await new Promise((r) => setTimeout(r, 50));

			// Verify all guests have received the final document
			for (const guest of guests) {
				const latestDoc = guest.receivedDocs[guest.receivedDocs.length - 1];
				expect(latestDoc).toBeDefined();
				expect(latestDoc.moves.length).toBe(4);
				expect(latestDoc.moves.map((m) => m.playerId)).toEqual(playerIds);
			}

			// Deterministic trick resolution check
			const trickPlays: TrickPlay[] = finalDoc.moves.map((m) => ({
				playerId: m.playerId,
				card: m.card
			}));
			const result = resolveTrick(trickPlays);

			// Led suit was hearts (Host played 9 of hearts first). Guest 0 played Ace of hearts.
			expect(result.winnerId).toBe(guests[0].id);
			expect(result.winningCard.rank).toBe(14);
			expect(result.winningCard.suit).toBe('hearts');

			// Zero state divergence: verify all guests derive the exact same trick winner as host
			for (const guest of guests) {
				const guestDoc = guest.receivedDocs[guest.receivedDocs.length - 1];
				const guestTrick = resolveTrick(
					guestDoc.moves.map((m) => ({ playerId: m.playerId, card: m.card }))
				);
				expect(guestTrick.winnerId).toBe(result.winnerId);
				expect(guestTrick.winningCard).toEqual(result.winningCard);
			}
		});

		it('handles concurrent card submissions at a 7-player table with zero state divergence', async () => {
			const { host, guests, allNodes } = await createConnectedStarTopology(7, 'TRICK7');
			activeNodes.push(...allNodes);

			const playerIds = allNodes.map((n) => n.id);
			const baseDoc: GameDocument = {
				roomId: 'room-TRICK7',
				phase: 'playing',
				currentRound: 0,
				seed: 99,
				dealerIndex: 0,
				moves: [],
				playerIds,
				roundScores: [],
				lastUpdate: Date.now()
			};

			await host.manager.broadcast({
				type: 'sync_doc',
				roomId: baseDoc.roomId,
				doc: baseDoc
			});
			await new Promise((r) => setTimeout(r, 40));

			// 7 players concurrently submit card plays
			const cards: Card[] = [
				{ suit: 'diamonds', rank: 8 },  // Host (Led)
				{ suit: 'diamonds', rank: 11 }, // Guest 1 (Jack)
				{ suit: 'diamonds', rank: 13 }, // Guest 2 (King) - Highest led suit!
				{ suit: 'diamonds', rank: 4 },  // Guest 3
				{ suit: 'clubs', rank: 14 },     // Guest 4 (Ace of clubs, off-suit)
				{ suit: 'diamonds', rank: 10 }, // Guest 5
				{ suit: 'diamonds', rank: 2 }   // Guest 6
			];

			const moves: Move[] = allNodes.map((node, i) => ({
				playerId: node.id,
				card: cards[i],
				timestamp: 2000 + i * 5
			}));

			const finalDoc: GameDocument = {
				...baseDoc,
				moves,
				lastUpdate: Date.now() + 1000
			};

			await host.manager.broadcast({
				type: 'sync_doc',
				roomId: finalDoc.roomId,
				doc: finalDoc
			});
			await new Promise((r) => setTimeout(r, 60));

			// Verify all 6 guests received identical document
			for (const guest of guests) {
				const latestDoc = guest.receivedDocs[guest.receivedDocs.length - 1];
				expect(latestDoc).toBeDefined();
				expect(latestDoc.moves.length).toBe(7);
			}

			// Deterministic trick resolution across 7 players
			const trickPlays = finalDoc.moves.map((m) => ({
				playerId: m.playerId,
				card: m.card
			}));
			const result = resolveTrick(trickPlays);

			// King of Diamonds from Guest 2 wins
			expect(result.winnerId).toBe(guests[1].id);
			expect(result.winningCard.rank).toBe(13);
			expect(result.winningCard.suit).toBe('diamonds');

			// Zero state divergence check across all guests and host
			for (const guest of guests) {
				const guestDoc = guest.receivedDocs[guest.receivedDocs.length - 1];
				const guestTrick = resolveTrick(
					guestDoc.moves.map((m) => ({ playerId: m.playerId, card: m.card }))
				);
				expect(guestTrick.winnerId).toBe(result.winnerId);
			}
		});
	});

	describe('Rapid Bidding Phase Message Propagation Across Peers', () => {
		it('propagates rapid concurrent bids across peers without message loss or out-of-order divergence', async () => {
			const { host, guests, allNodes } = await createConnectedStarTopology(4, 'BIDS01');
			activeNodes.push(...allNodes);

			// Oh Well bidding state
			const bids: Record<string, number> = {};
			const baseDoc: GameDocument = {
				roomId: 'room-BIDS01',
				phase: 'bidding',
				currentRound: 0,
				seed: 777,
				dealerIndex: 0,
				moves: [],
				playerIds: allNodes.map((n) => n.id),
				roundScores: [],
				gameSpecific: { bids, trumpSuit: 'hearts' },
				lastUpdate: Date.now()
			};

			await host.manager.broadcast({
				type: 'sync_doc',
				roomId: baseDoc.roomId,
				doc: baseDoc
			});
			await new Promise((r) => setTimeout(r, 30));

			// Rapid sequential / concurrent bids from all 4 players
			const submittedBids = [
				{ playerId: host.id, bid: 2 },
				{ playerId: guests[0].id, bid: 0 },
				{ playerId: guests[1].id, bid: 1 },
				{ playerId: guests[2].id, bid: 3 }
			];

			let currentDoc = baseDoc;
			for (const b of submittedBids) {
				const nextBids = { ...(currentDoc.gameSpecific as any).bids, [b.playerId]: b.bid };
				currentDoc = {
					...currentDoc,
					gameSpecific: { ...(currentDoc.gameSpecific as any), bids: nextBids },
					lastUpdate: Date.now() + 10
				};
				await host.manager.broadcast({
					type: 'sync_doc',
					roomId: currentDoc.roomId,
					doc: currentDoc
				});
			}

			await new Promise((r) => setTimeout(r, 60));

			// Verify all 3 guests converged to the final bid state with all 4 bids intact
			for (const guest of guests) {
				const latestDoc = guest.receivedDocs[guest.receivedDocs.length - 1];
				expect(latestDoc).toBeDefined();
				const recordedBids = (latestDoc.gameSpecific as any)?.bids;
				expect(recordedBids[host.id]).toBe(2);
				expect(recordedBids[guests[0].id]).toBe(0);
				expect(recordedBids[guests[1].id]).toBe(1);
				expect(recordedBids[guests[2].id]).toBe(3);
			}
		});
	});

	describe('Host Relay Efficiency & Asymmetric Bridge', () => {
		it('rebroadcasts peer move to all active peer DataChannels with zero state divergence', async () => {
			const { host, guests, allNodes } = await createConnectedStarTopology(4, 'RELAY01');
			activeNodes.push(...allNodes);

			const moveDoc: GameDocument = {
				roomId: 'room-RELAY01',
				phase: 'playing',
				currentRound: 0,
				seed: 123,
				dealerIndex: 0,
				moves: [{ playerId: guests[0].id, card: { suit: 'hearts', rank: 10 }, timestamp: 500 }],
				playerIds: allNodes.map((n) => n.id),
				roundScores: [],
				lastUpdate: Date.now()
			};

			const syncMsg: P2pMessage = {
				type: 'sync_doc',
				roomId: moveDoc.roomId,
				doc: moveDoc,
				senderId: guests[0].id
			};

			// Guest 0 sends move over its DataChannel to Host
			// Host WebRtcPeer onMessage triggers:
			// 1. Host local dispatch
			// 2. Host relayToOtherPeers('guest-0', msg) to Guest 1 and Guest 2
			await (host.manager as any).relayToOtherPeers(guests[0].id, syncMsg);

			await new Promise((r) => setTimeout(r, 40));

			// Guest 1 and Guest 2 should have received the doc
			expect(guests[1].receivedDocs.length).toBeGreaterThanOrEqual(1);
			expect(guests[2].receivedDocs.length).toBeGreaterThanOrEqual(1);

			const g1Doc = guests[1].receivedDocs[guests[1].receivedDocs.length - 1];
			const g2Doc = guests[2].receivedDocs[guests[2].receivedDocs.length - 1];
			expect(g1Doc.moves[0].card.rank).toBe(10);
			expect(g2Doc.moves[0].card.rank).toBe(10);
		});

		it('bridges to MQTT when any peer DataChannel is not open during host relay', async () => {
			const { host, guests, allNodes } = await createConnectedStarTopology(3, 'BRIDGE01');
			activeNodes.push(...allNodes);

			// Forcibly close Guest 1 DataChannel while Guest 0 remains open
			const hostPeerG1 = (host.manager as any).peers.get(guests[1].id);
			expect(hostPeerG1).toBeDefined();
			hostPeerG1.close(); // Closed on Host side

			// Guest 0 sends move to Host
			const moveDoc: GameDocument = {
				roomId: 'room-BRIDGE01',
				phase: 'playing',
				currentRound: 0,
				seed: 456,
				dealerIndex: 0,
				moves: [{ playerId: guests[0].id, card: { suit: 'spades', rank: 14 }, timestamp: 600 }],
				playerIds: allNodes.map((n) => n.id),
				roundScores: [],
				lastUpdate: Date.now()
			};

			const syncMsg: P2pMessage = {
				type: 'sync_doc',
				roomId: moveDoc.roomId,
				doc: moveDoc,
				senderId: guests[0].id
			};

			// Host relays move: Guest 1 DataChannel is closed, so Host MUST bridge to MQTT
			await host.manager.relayToOtherPeers(guests[0].id, syncMsg);

			await new Promise((r) => setTimeout(r, 50));

			// Guest 1 receives the relayed move via MQTT bridge!
			expect(guests[1].receivedDocs.length).toBeGreaterThanOrEqual(1);
			const g1Doc = guests[1].receivedDocs[guests[1].receivedDocs.length - 1];
			expect(g1Doc.moves[0].card.suit).toBe('spades');
			expect(g1Doc.moves[0].card.rank).toBe(14);
		});
	});

	describe('Latency Tracking & Ping/Pong Heartbeat Measurement', () => {
		it('measures RTT and updates latencyMs upon receiving pong responses', async () => {
			const { host, guests, allNodes } = await createConnectedStarTopology(2, 'PING01');
			activeNodes.push(...allNodes);

			const t0 = Date.now() - 40; // 40ms simulated roundtrip
			const pingMsg: P2pMessage = {
				type: 'ping',
				senderId: host.id,
				timestamp: t0
			};

			// Host sends ping to Guest 0 over DataChannel
			await (guests[0].manager as any).handleIncomingMessage(pingMsg);

			await new Promise((r) => setTimeout(r, 40));

			// Guest 0 responds with pong to Host
			const pongMsg: P2pMessage = {
				type: 'pong',
				senderId: guests[0].id,
				timestamp: t0
			};
			await (host.manager as any).handleIncomingMessage(pongMsg);

			// Verify latencyMs calculated and emitted
			expect(host.lastStatus?.latencyMs).toBeDefined();
			expect(host.lastStatus?.latencyMs).toBeGreaterThanOrEqual(1);
		});

		it('tracks peer health across all connected peers in periodic heartbeat cycle', async () => {
			const { host, guests, allNodes } = await createConnectedStarTopology(3, 'HEART01');
			activeNodes.push(...allNodes);

			const now = Date.now();
			for (const guest of guests) {
				await (host.manager as any).handleIncomingMessage({
					type: 'pong',
					senderId: guest.id,
					timestamp: now - 30
				});
			}

			expect(host.lastStatus?.directPeersCount).toBe(2);
			expect(host.lastStatus?.latencyMs).toBeDefined();
			expect(host.lastStatus?.latencyMs).toBeGreaterThanOrEqual(1);
		});
	});
});
