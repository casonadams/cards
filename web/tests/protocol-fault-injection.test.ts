import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import {
	BROKER_URLS,
	WebRtcPeer,
	deriveRoomKey,
	encryptData,
	decryptData,
	isValidMessage,
	type P2pMessage
} from '$lib/platform/adapters/p2p-webrtc.ts';
import {
	shouldAcceptDocUpdate,
	DocDedupCache,
	deduplicateMoves,
	type GameDocument,
	type Move
} from '$lib/platform/engine/game-sync.ts';
import {
	installMockNetwork,
	restoreMockNetwork,
	createTestNode,
	createCorruptedCiphertextEnvelope,
	createBadIvEnvelope,
	createWrongKeyEnvelope,
	destroyNodes,
	MockBrokerCluster,
	MockRTCPeerConnection,
	type MockHarnessContext,
	type TestNode
} from './helpers/mock-network.ts';

describe('R1: Protocol & Fault-Injection Tests', () => {
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

	describe('Multi-Broker Sequenced Failover Across 3-Broker Pool', () => {
		it('fails over from broker 0 to broker 1 when broker 0 connection is refused', async () => {
			cluster.setBrokerStatus(BROKER_URLS[0], 'error');
			cluster.setBrokerStatus(BROKER_URLS[1], 'online');

			const node = await createTestNode('node-failover-1', false, 'FAIL01');
			activeNodes.push(node);

			expect(node.manager.currentBrokerIndex).toBe(1);
			expect(node.lastStatus?.brokerIndex).toBe(1);
			expect(node.lastStatus?.brokerUrl).toBe(BROKER_URLS[1]);
			expect(node.lastStatus?.mode).toBe('relay');
		});

		it('fails over across broker 0 and broker 1 to broker 2 when first two fail', async () => {
			cluster.setBrokerStatus(BROKER_URLS[0], 'error');
			cluster.setBrokerStatus(BROKER_URLS[1], 'error');
			cluster.setBrokerStatus(BROKER_URLS[2], 'online');

			const node = await createTestNode('node-failover-2', false, 'FAIL02');
			activeNodes.push(node);

			expect(node.manager.currentBrokerIndex).toBe(2);
			expect(node.lastStatus?.brokerIndex).toBe(2);
			expect(node.lastStatus?.brokerUrl).toBe(BROKER_URLS[2]);
		});

		it('gracefully emits disconnected status and returns false when all 3 brokers fail', async () => {
			cluster.setBrokerStatus(BROKER_URLS[0], 'error');
			cluster.setBrokerStatus(BROKER_URLS[1], 'error');
			cluster.setBrokerStatus(BROKER_URLS[2], 'error');

			const node = await createTestNode('node-failover-all', false, 'FAIL03');
			activeNodes.push(node);

			expect(node.lastStatus?.mode).toBe('disconnected');
		});

		it('handles mid-session broker drops and automatically fails over to the next broker', async () => {
			// Initially broker 0 is online
			const node = await createTestNode('node-mid-drop', true, 'DROP01');
			activeNodes.push(node);

			expect(node.manager.currentBrokerIndex).toBe(0);

			// Simulate active broker 0 going down with socket drop
			cluster.dropBroker(BROKER_URLS[0], true);

			// Allow reconnection loop microtasks to settle
			await new Promise((r) => setTimeout(r, 60));

			// Should have automatically failed over to broker 1
			expect(node.manager.currentBrokerIndex).toBe(1);
			expect(node.lastStatus?.brokerIndex).toBe(1);
			expect(node.lastStatus?.brokerUrl).toBe(BROKER_URLS[1]);
		});

		it('wraps around to broker 0 when broker 2 drops', async () => {
			// Broker 0 and 1 down initially -> connects to broker 2
			cluster.setBrokerStatus(BROKER_URLS[0], 'error');
			cluster.setBrokerStatus(BROKER_URLS[1], 'error');
			cluster.setBrokerStatus(BROKER_URLS[2], 'online');

			const node = await createTestNode('node-wrap', true, 'WRAP01');
			activeNodes.push(node);

			expect(node.manager.currentBrokerIndex).toBe(2);

			// Now bring broker 0 back online and drop broker 2
			cluster.setBrokerStatus(BROKER_URLS[0], 'online');
			cluster.dropBroker(BROKER_URLS[2], true);

			await new Promise((r) => setTimeout(r, 60));

			// (2 + 1) % 3 = 0 -> broker 0
			expect(node.manager.currentBrokerIndex).toBe(0);
			expect(node.lastStatus?.brokerIndex).toBe(0);
		});

		it('records exact sequenced broker connection attempts in history', async () => {
			cluster.setBrokerStatus(BROKER_URLS[0], 'error');
			cluster.setBrokerStatus(BROKER_URLS[1], 'error');
			cluster.setBrokerStatus(BROKER_URLS[2], 'online');

			const node = await createTestNode('node-history', false, 'HIST01');
			activeNodes.push(node);

			const attempts = cluster.connectAttempts.map((a) => a.brokerUrl);
			expect(attempts[0]).toBe(BROKER_URLS[0]);
			expect(attempts[1]).toBe(BROKER_URLS[1]);
			expect(attempts[2]).toBe(BROKER_URLS[2]);
		});
	});

	describe('Zero Unhandled Promise Rejections & Socket Drop Robustness', () => {
		it('drops active socket abruptly without unhandled promise rejections or uncaught exceptions', async () => {
			let unhandledRejectionCount = 0;
			let uncaughtExceptionCount = 0;

			const onRejection = () => {
				unhandledRejectionCount++;
			};
			const onException = () => {
				uncaughtExceptionCount++;
			};

			process.on('unhandledRejection', onRejection);
			process.on('uncaughtException', onException);

			try {
				const node = await createTestNode('node-robust-1', false, 'ROBUST');
				activeNodes.push(node);

				// Abrupt socket drop during active session
				cluster.dropBroker(BROKER_URLS[0], true);
				await new Promise((r) => setTimeout(r, 50));

				// Second drop on newly connected broker
				cluster.dropBroker(BROKER_URLS[1], true);
				await new Promise((r) => setTimeout(r, 50));

				expect(unhandledRejectionCount).toBe(0);
				expect(uncaughtExceptionCount).toBe(0);
			} finally {
				process.removeListener('unhandledRejection', onRejection);
				process.removeListener('uncaughtException', onException);
			}
		});

		it('tolerates abrupt destroy() while broker failover is actively pending', async () => {
			cluster.setBrokerStatus(BROKER_URLS[0], 'error');
			cluster.setBrokerStatus(BROKER_URLS[1], 'error');

			const node = await createTestNode('node-destroy-race', false, 'DESTRC');
			// Immediately destroy without waiting
			node.manager.destroy();

			await new Promise((r) => setTimeout(r, 40));
			expect(node.lastStatus?.mode).toBe('disconnected');
		});
	});

	describe('ICE Candidate Arrival Race Conditions & Buffering', () => {
		it('buffers ICE candidate arriving BEFORE remote description is set and drains upon offer/answer', async () => {
			let signalSent = false;
			const peer = new WebRtcPeer(
				'remote-peer-early',
				() => {
					signalSent = true;
				},
				() => {},
				() => {}
			);

			// Add candidate while remoteDescription is null
			const earlyCandidate: RTCIceCandidateInit = {
				candidate: 'candidate:1 1 UDP 2122260223 127.0.0.1 50001 typ host',
				sdpMid: '0',
				sdpMLineIndex: 0
			};

			await peer.addIceCandidate(earlyCandidate);

			// Underlying PC should not have candidate yet because remoteDescription is null
			const pc = (peer as any).pc as MockRTCPeerConnection;
			expect(pc.remoteDescription).toBeNull();
			expect(pc.addedIceCandidates.length).toBe(0);
			expect((peer as any).pendingCandidates.length).toBe(1);

			// Now supply remote offer
			const dummyOffer: RTCSessionDescriptionInit = {
				type: 'offer',
				sdp: `v=0\no=- ${pc.id} 2 IN IP4 127.0.0.1\ns=-\nt=0 0`
			};
			await peer.handleOffer(dummyOffer);

			// Candidate should now be drained to underlying PC
			expect(pc.addedIceCandidates.length).toBe(1);
			expect(pc.addedIceCandidates[0].candidate).toBe(earlyCandidate.candidate);
			expect((peer as any).pendingCandidates.length).toBe(0);
			// Local PC emits its own ICE candidate upon setLocalDescription(answer)
			expect(signalSent).toBe(true);

			peer.close();
		});

		it('buffers ICE candidate arriving BEFORE peer is created on manager and drains on peer creation', async () => {
			const host = await createTestNode('host-ice-race', true, 'ICERAC');
			activeNodes.push(host);

			const earlyCandidate: RTCIceCandidateInit = {
				candidate: 'candidate:2 1 UDP 2122260223 127.0.0.1 50002 typ host',
				sdpMid: '0',
				sdpMLineIndex: 0
			};

			// Guest sends signal_ice before Host has created WebRtcPeer for Guest
			const guestId = 'guest-unannounced';
			const iceSignalMsg: P2pMessage = {
				type: 'signal_ice',
				senderId: guestId,
				targetId: host.id,
				candidate: earlyCandidate
			};

			// Simulate receiving signal_ice directly on manager
			await (host.manager as any).handleIncomingMessage(iceSignalMsg);

			// Verify early candidate was stored in earlyIceCandidates
			const earlyList = host.manager.getEarlyCandidates(guestId);
			expect(earlyList.length).toBe(1);
			expect(earlyList[0].candidate).toBe(earlyCandidate.candidate);

			// Later, when peer is created (e.g. host initiates or guest sends offer)
			const peer = (host.manager as any).getOrCreatePeer(guestId);
			expect(peer).toBeDefined();

			// Buffer should now be drained from early candidates
			expect(host.manager.getEarlyCandidates(guestId).length).toBe(0);
		});

		it('buffers multiple ICE candidates and drains them in strict FIFO order', async () => {
			const peer = new WebRtcPeer(
				'remote-fifo',
				() => {},
				() => {},
				() => {}
			);

			const c1 = { candidate: 'candidate:first', sdpMid: '0', sdpMLineIndex: 0 };
			const c2 = { candidate: 'candidate:second', sdpMid: '0', sdpMLineIndex: 1 };
			const c3 = { candidate: 'candidate:third', sdpMid: '0', sdpMLineIndex: 2 };

			await peer.addIceCandidate(c1);
			await peer.addIceCandidate(c2);
			await peer.addIceCandidate(c3);

			expect((peer as any).pendingCandidates.length).toBe(3);

			const pc = (peer as any).pc as MockRTCPeerConnection;
			await peer.handleAnswer({
				type: 'answer',
				sdp: `v=0\no=- ${pc.id} 2 IN IP4 127.0.0.1\ns=-\nt=0 0`
			});

			expect(pc.addedIceCandidates.length).toBe(3);
			expect(pc.addedIceCandidates[0].candidate).toBe('candidate:first');
			expect(pc.addedIceCandidates[1].candidate).toBe('candidate:second');
			expect(pc.addedIceCandidates[2].candidate).toBe('candidate:third');

			peer.close();
		});

		it('gracefully catches underlying ICE candidate addition errors without crashing', async () => {
			MockRTCPeerConnection.simulateIceFailure = true;

			const peer = new WebRtcPeer(
				'remote-err',
				() => {},
				() => {},
				() => {}
			);

			const pc = (peer as any).pc as MockRTCPeerConnection;
			await peer.handleOffer({
				type: 'offer',
				sdp: `v=0\no=- ${pc.id} 2 IN IP4 127.0.0.1\ns=-\nt=0 0`
			});

			// Should catch the error inside try/catch and not throw
			await expect(
				peer.addIceCandidate({ candidate: 'bad:cand', sdpMid: '0', sdpMLineIndex: 0 })
			).resolves.toBeUndefined();

			MockRTCPeerConnection.simulateIceFailure = false;
			peer.close();
		});
	});

	describe('AES-GCM Envelope Tamper & Malformed Packet Rejection', () => {
		it('drops messages with corrupted ciphertext without crashing', async () => {
			const node = await createTestNode('node-crypto-1', true, 'CRYP01');
			activeNodes.push(node);

			const sampleMsg: P2pMessage = {
				type: 'query_room',
				code: 'CRYP01',
				senderId: 'attacker-1'
			};

			const corruptedPayload = await createCorruptedCiphertextEnvelope('CRYP01', sampleMsg);

			// Direct decryption fails authentication tag check
			const key = await deriveRoomKey('CRYP01');
			await expect(decryptData(key, corruptedPayload)).rejects.toThrow();

			// Delivery via MQTT drops packet silently without crashing manager
			const client = (node.manager as any).client;
			client.emit('message', `cards/v1/CRYP01`, Buffer.from(corruptedPayload));

			await new Promise((r) => setTimeout(r, 30));
			// No rooms, join requests, or queries processed
			expect(node.receivedRooms.length).toBe(0);
		});

		it('drops envelopes with invalid or truncated IV length without crashing', async () => {
			const node = await createTestNode('node-crypto-2', true, 'CRYP02');
			activeNodes.push(node);

			const sampleMsg: P2pMessage = {
				type: 'query_room',
				code: 'CRYP02',
				senderId: 'attacker-2'
			};

			const badIvPayload = await createBadIvEnvelope('CRYP02', sampleMsg, 6);

			const key = await deriveRoomKey('CRYP02');
			await expect(decryptData(key, badIvPayload)).rejects.toThrow();

			const client = (node.manager as any).client;
			client.emit('message', `cards/v1/CRYP02`, Buffer.from(badIvPayload));

			await new Promise((r) => setTimeout(r, 30));
			expect(node.receivedRooms.length).toBe(0);
		});

		it('drops envelopes encrypted with the wrong room key without crashing', async () => {
			const node = await createTestNode('node-crypto-3', true, 'ROOMAA');
			activeNodes.push(node);

			const sampleMsg: P2pMessage = {
				type: 'query_room',
				code: 'ROOMBB',
				senderId: 'user-room-b'
			};

			const wrongKeyPayload = await createWrongKeyEnvelope('ROOMAA', 'ROOMBB', sampleMsg);

			const client = (node.manager as any).client;
			client.emit('message', `cards/v1/ROOMAA`, Buffer.from(wrongKeyPayload));

			await new Promise((r) => setTimeout(r, 30));
			expect(node.receivedRooms.length).toBe(0);
		});

		it('drops envelopes whose decrypted payload is not valid JSON string', async () => {
			const node = await createTestNode('node-crypto-4', true, 'NOTJSON');
			activeNodes.push(node);

			const key = await deriveRoomKey('NOTJSON');
			// Encrypt plain string that is not JSON
			const iv = crypto.getRandomValues(new Uint8Array(12));
			const encoded = new TextEncoder().encode('this is raw plaintext, not json');
			const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
			const envelope = JSON.stringify({
				iv: Array.from(iv),
				ciphertext: Array.from(new Uint8Array(buf))
			});

			const client = (node.manager as any).client;
			client.emit('message', `cards/v1/NOTJSON`, Buffer.from(envelope));

			await new Promise((r) => setTimeout(r, 30));
			expect(node.receivedRooms.length).toBe(0);
		});

		it('drops decrypted payloads that fail isValidMessage schema validation', async () => {
			const node = await createTestNode('node-crypto-5', true, 'INVALM');
			activeNodes.push(node);

			const key = await deriveRoomKey('INVALM');
			// Missing senderId
			const invalidMsg = { type: 'ping' };
			const envelope = await encryptData(key, invalidMsg);

			expect(isValidMessage(invalidMsg)).toBe(false);

			const client = (node.manager as any).client;
			client.emit('message', `cards/v1/INVALM`, Buffer.from(envelope));

			await new Promise((r) => setTimeout(r, 30));
			expect(node.statuses.filter((s) => s.latencyMs !== undefined).length).toBe(0);
		});

		it('drops non-envelope raw strings without crashing', async () => {
			const key = await deriveRoomKey('RAWKEY');
			await expect(decryptData(key, 'random non-json garbage')).rejects.toThrow();
			await expect(decryptData(key, '{"missingIv": true}')).rejects.toThrow();
			await expect(decryptData(key, '{"iv": "not-array", "ciphertext": []}')).rejects.toThrow();
		});
	});

	describe('Duplicate Message Suppression & Move Reconciliation', () => {
		const baseDoc: GameDocument = {
			roomId: 'room-1',
			phase: 'playing',
			currentRound: 1,
			seed: 12345,
			dealerIndex: 0,
			moves: [
				{ playerId: 'p1', card: { suit: 'hearts', rank: 10 }, timestamp: 100 },
				{ playerId: 'p2', card: { suit: 'hearts', rank: 14 }, timestamp: 200 }
			],
			playerIds: ['p1', 'p2'],
			roundScores: [],
			lastUpdate: 1000
		};

		it('shouldAcceptDocUpdate correctly handles round transitions and regressions', () => {
			// Incoming earlier round -> REJECT
			const earlierRound: GameDocument = { ...baseDoc, currentRound: 0 };
			expect(shouldAcceptDocUpdate(earlierRound, baseDoc)).toBe(false);

			// Incoming later round -> ACCEPT
			const nextRound: GameDocument = { ...baseDoc, currentRound: 2, moves: [] };
			expect(shouldAcceptDocUpdate(nextRound, baseDoc)).toBe(true);

			// Initial state with null current -> ACCEPT
			expect(shouldAcceptDocUpdate(baseDoc, null)).toBe(true);

			// Null incoming -> REJECT
			expect(shouldAcceptDocUpdate(null as unknown as GameDocument, baseDoc)).toBe(false);
		});

		it('shouldAcceptDocUpdate rejects same-round documents with fewer moves or stale lastUpdate', () => {
			// Fewer moves -> REJECT
			const fewerMoves: GameDocument = {
				...baseDoc,
				moves: baseDoc.moves.slice(0, 1),
				lastUpdate: 1050
			};
			expect(shouldAcceptDocUpdate(fewerMoves, baseDoc)).toBe(false);

			// Equal moves with older lastUpdate -> REJECT
			const staleUpdate: GameDocument = {
				...baseDoc,
				lastUpdate: 999
			};
			expect(shouldAcceptDocUpdate(staleUpdate, baseDoc)).toBe(false);

			// Equal moves with newer lastUpdate -> ACCEPT
			const freshUpdate: GameDocument = {
				...baseDoc,
				lastUpdate: 1001
			};
			expect(shouldAcceptDocUpdate(freshUpdate, baseDoc)).toBe(true);

			// More moves -> ACCEPT
			const moreMoves: GameDocument = {
				...baseDoc,
				moves: [
					...baseDoc.moves,
					{ playerId: 'p1', card: { suit: 'clubs', rank: 5 }, timestamp: 300 }
				],
				lastUpdate: 1000
			};
			expect(shouldAcceptDocUpdate(moreMoves, baseDoc)).toBe(true);
		});

		it('DocDedupCache detects duplicate documents, generates deterministic keys, and respects LRU bounds', () => {
			const cache = new DocDedupCache(3);

			const key = cache.getDocKey(baseDoc);
			expect(key).toBe('room-1:1:2:1000');

			expect(cache.has(baseDoc)).toBe(false);
			cache.add(baseDoc);
			expect(cache.has(baseDoc)).toBe(true);

			const doc2: GameDocument = { ...baseDoc, lastUpdate: 1001 };
			const doc3: GameDocument = { ...baseDoc, lastUpdate: 1002 };
			const doc4: GameDocument = { ...baseDoc, lastUpdate: 1003 };

			cache.add(doc2);
			cache.add(doc3);
			// Cache now has [baseDoc, doc2, doc3] (capacity 3)
			expect(cache.has(baseDoc)).toBe(true);

			// Adding 4th document should evict oldest (baseDoc)
			cache.add(doc4);
			expect(cache.has(baseDoc)).toBe(false);
			expect(cache.has(doc2)).toBe(true);
			expect(cache.has(doc3)).toBe(true);
			expect(cache.has(doc4)).toBe(true);

			cache.clear();
			expect(cache.has(doc4)).toBe(false);
		});

		it('deduplicateMoves filters duplicate card plays while strictly preserving order', () => {
			const move1: Move = { playerId: 'p1', card: { suit: 'hearts', rank: 14 }, timestamp: 100 };
			const move1Dup: Move = { playerId: 'p1', card: { suit: 'hearts', rank: 14 }, timestamp: 100 };
			const move2: Move = { playerId: 'p2', card: { suit: 'hearts', rank: 10 }, timestamp: 100 }; // Different player, same time
			const move3: Move = { playerId: 'p1', card: { suit: 'hearts', rank: 14 }, timestamp: 200 }; // Same card, later time
			const move4: Move = { playerId: 'p1', card: { suit: 'spades', rank: 14 }, timestamp: 100 }; // Different suit

			const input: Move[] = [move1, move1Dup, move2, move3, move4, move1Dup];
			const result = deduplicateMoves(input);

			expect(result.length).toBe(4);
			expect(result[0]).toBe(move1);
			expect(result[1]).toBe(move2);
			expect(result[2]).toBe(move3);
			expect(result[3]).toBe(move4);
		});
	});
});
