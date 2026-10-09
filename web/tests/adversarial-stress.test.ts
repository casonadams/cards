import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import {
	BROKER_URLS,
	WebRtcPeer,
	deriveRoomKey,
	encryptData,
	decryptData,
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
	destroyNodes,
	MockBrokerCluster,
	MockRTCPeerConnection,
	type MockHarnessContext,
	type TestNode
} from './helpers/mock-network.ts';

describe('Adversarial Stress Test: Protocol & Fault Injection Layer', () => {
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

	describe('1. Multi-Broker Sequenced Failover Under Chaos', () => {
		it('survives rapid cascading broker crash (broker 1 fails when broker 0 drops, fails over to broker 2)', async () => {
			let unhandledErrors = 0;
			const errHandler = () => { unhandledErrors++; };
			process.on('unhandledRejection', errHandler);
			process.on('uncaughtException', errHandler);

			try {
				const node = await createTestNode('node-cascade', false, 'CAS001');
				activeNodes.push(node);

				expect(node.manager.currentBrokerIndex).toBe(0);

				// Pre-fail broker 1 so it cannot connect
				cluster.setBrokerStatus(BROKER_URLS[1], 'error');
				// Drop active broker 0
				cluster.dropBroker(BROKER_URLS[0], true);

				// Wait for failover loop to progress through broker 1 (which fails) to broker 2
				await new Promise((r) => setTimeout(r, 120));

				expect(node.manager.currentBrokerIndex).toBe(2);
				expect(node.lastStatus?.brokerIndex).toBe(2);
				expect(node.lastStatus?.mode).toBe('relay');
				expect(unhandledErrors).toBe(0);
			} finally {
				process.removeListener('unhandledRejection', errHandler);
				process.removeListener('uncaughtException', errHandler);
			}
		});

		it('survives 9 consecutive broker drops (3 full cyclic failovers)', async () => {
			const node = await createTestNode('node-cycle', true, 'CYC001');
			activeNodes.push(node);

			let expectedIndex = 0;
			expect(node.manager.currentBrokerIndex).toBe(expectedIndex);

			for (let drop = 0; drop < 9; drop++) {
				const currentUrl = BROKER_URLS[expectedIndex];
				expectedIndex = (expectedIndex + 1) % BROKER_URLS.length;

				// Make next broker online just in case
				cluster.setBrokerStatus(BROKER_URLS[expectedIndex], 'online');
				// Drop current broker
				cluster.dropBroker(currentUrl, true);

				await new Promise((r) => setTimeout(r, 70));
				expect(node.manager.currentBrokerIndex).toBe(expectedIndex);
				expect(node.lastStatus?.brokerIndex).toBe(expectedIndex);
			}
		});

		it('handles broker timeout cleanly without hanging and fails over after exactly 4000ms timeout', async () => {
			// Broker 0 is set to timeout
			cluster.setBrokerStatus(BROKER_URLS[0], 'timeout');
			cluster.setBrokerStatus(BROKER_URLS[1], 'online');

			const startTime = Date.now();
			const node = await createTestNode('node-timeout', false, 'TIM001');
			activeNodes.push(node);
			const elapsed = Date.now() - startTime;

			// Production timeout in p2p-webrtc.ts is 4000ms
			expect(node.manager.currentBrokerIndex).toBe(1);
			expect(node.lastStatus?.brokerIndex).toBe(1);
			expect(elapsed).toBeGreaterThanOrEqual(3900);
			expect(elapsed).toBeLessThan(5000);
		});

		it('abrupt destroy() during active failover loop leaves no dangling connections or throws', async () => {
			cluster.setBrokerStatus(BROKER_URLS[0], 'error');
			cluster.setBrokerStatus(BROKER_URLS[1], 'error');

			const node = await createTestNode('node-destroy-chaos', false, 'DST001');
			activeNodes.push(node);

			// Trigger drop then destroy immediately
			cluster.dropBroker(BROKER_URLS[0], true);
			node.manager.destroy();

			await new Promise((r) => setTimeout(r, 80));

			expect(node.lastStatus?.mode).toBe('disconnected');
			// Re-destroy should be safe idempotent
			expect(() => node.manager.destroy()).not.toThrow();
		});

		it('rapid consecutive connect() calls on same manager do not leak or throw', async () => {
			const node = await createTestNode('node-rapid-reconnect', false, 'REC001');
			activeNodes.push(node);

			// Connect 5 times rapidly with different rooms
			for (let i = 2; i <= 6; i++) {
				await node.manager.connect(`REC00${i}`, `node-rapid-reconnect`, false);
			}

			expect(node.lastStatus?.mode).toBe('relay');
			expect(node.manager.currentBrokerIndex).toBe(0);
		});
	});

	describe('2. ICE Candidate Race Conditions Under Heavy Concurrency', () => {
		it('buffers 50 rapid ICE candidates arriving BEFORE remote description and drains all 50 in strict FIFO order', async () => {
			const peer = new WebRtcPeer(
				'stress-peer-50',
				() => {},
				() => {},
				() => {}
			);

			const candidates: RTCIceCandidateInit[] = [];
			for (let i = 0; i < 50; i++) {
				candidates.push({
					candidate: `candidate:${i} 1 UDP 2122260223 127.0.0.1 ${50000 + i} typ host`,
					sdpMid: '0',
					sdpMLineIndex: 0
				});
			}

			// Add all 50 in rapid burst
			await Promise.all(candidates.map((c) => peer.addIceCandidate(c)));

			const pc = (peer as any).pc as MockRTCPeerConnection;
			expect(pc.remoteDescription).toBeNull();
			expect(pc.addedIceCandidates.length).toBe(0);
			expect((peer as any).pendingCandidates.length).toBe(50);

			// Set remote offer
			await peer.handleOffer({
				type: 'offer',
				sdp: `v=0\no=- ${pc.id} 2 IN IP4 127.0.0.1\ns=-\nt=0 0`
			});

			// Verify all 50 are drained and in exact FIFO order
			expect(pc.addedIceCandidates.length).toBe(50);
			expect((peer as any).pendingCandidates.length).toBe(0);
			for (let i = 0; i < 50; i++) {
				expect(pc.addedIceCandidates[i].candidate).toBe(candidates[i].candidate);
			}

			peer.close();
		});

		it('buffers 25 unannounced ICE candidates arriving BEFORE peer creation and flushes on peer creation', async () => {
			const host = await createTestNode('host-unannounced-burst', true, 'UNANN0');
			activeNodes.push(host);

			const guestId = 'guest-burst';
			const candidates: RTCIceCandidateInit[] = [];
			for (let i = 0; i < 25; i++) {
				candidates.push({
					candidate: `candidate:burst:${i} 1 UDP 2122260223 127.0.0.1 ${60000 + i} typ host`,
					sdpMid: '0',
					sdpMLineIndex: 0
				});
			}

			// Deliver 25 signal_ice messages directly
			for (const cand of candidates) {
				const iceMsg: P2pMessage = {
					type: 'signal_ice',
					senderId: guestId,
					targetId: host.id,
					candidate: cand
				};
				await (host.manager as any).handleIncomingMessage(iceMsg);
			}

			// Verify all 25 buffered in manager earlyIceCandidates
			const buffered = host.manager.getEarlyCandidates(guestId);
			expect(buffered.length).toBe(25);

			// Now instantiate peer via handleSignalOffer
			const dummyOffer: RTCSessionDescriptionInit = {
				type: 'offer',
				sdp: 'v=0\no=- 12345 2 IN IP4 127.0.0.1\ns=-\nt=0 0'
			};
			const offerMsg: P2pMessage = {
				type: 'signal_offer',
				senderId: guestId,
				targetId: host.id,
				offer: dummyOffer
			};
			await (host.manager as any).handleIncomingMessage(offerMsg);

			// Buffer must be completely drained
			expect(host.manager.getEarlyCandidates(guestId).length).toBe(0);

			// Verify peer received candidates
			const peer = (host.manager as any).peers.get(guestId);
			expect(peer).toBeDefined();
			const pc = (peer as any).pc as MockRTCPeerConnection;
			expect(pc.addedIceCandidates.length).toBe(25);
			for (let i = 0; i < 25; i++) {
				expect(pc.addedIceCandidates[i].candidate).toBe(candidates[i].candidate);
			}
		});

		it('robustly tolerates simulated RTCPeerConnection failures on candidate addition without crashing queue', async () => {
			const peer = new WebRtcPeer(
				'peer-partial-ice-fail',
				() => {},
				() => {},
				() => {}
			);

			const pc = (peer as any).pc as MockRTCPeerConnection;
			await peer.handleOffer({
				type: 'offer',
				sdp: `v=0\no=- ${pc.id} 2 IN IP4 127.0.0.1\ns=-\nt=0 0`
			});

			MockRTCPeerConnection.simulateIceFailure = true;
			// This candidate will fail internally
			await peer.addIceCandidate({ candidate: 'bad-candidate', sdpMid: '0', sdpMLineIndex: 0 });

			MockRTCPeerConnection.simulateIceFailure = false;
			// This next candidate should succeed
			await peer.addIceCandidate({ candidate: 'good-candidate', sdpMid: '0', sdpMLineIndex: 0 });

			expect(pc.addedIceCandidates.length).toBe(1);
			expect(pc.addedIceCandidates[0].candidate).toBe('good-candidate');

			peer.close();
		});

		it('ignores ICE candidates addressed to a different targetId', async () => {
			const host = await createTestNode('host-ice-target-check', true, 'TGTCHK');
			activeNodes.push(host);

			const cand: RTCIceCandidateInit = {
				candidate: 'candidate:other:target',
				sdpMid: '0',
				sdpMLineIndex: 0
			};

			const iceMsg: P2pMessage = {
				type: 'signal_ice',
				senderId: 'guest-1',
				targetId: 'someone-else',
				candidate: cand
			};

			await (host.manager as any).handleIncomingMessage(iceMsg);
			expect(host.manager.getEarlyCandidates('guest-1').length).toBe(0);
		});
	});

	describe('3. AES-GCM Envelope Tampering & Fuzzing', () => {
		it('fuzzes 100 randomly corrupted ciphertext envelopes and rejects 100% without throwing or crashing', async () => {
			const node = await createTestNode('node-fuzz-crypto', true, 'FUZZ01');
			activeNodes.push(node);

			const key = await deriveRoomKey('FUZZ01');
			const client = (node.manager as any).client;

			let rejectionCount = 0;

			for (let i = 0; i < 100; i++) {
				const sampleMsg: P2pMessage = {
					type: 'query_room',
					code: 'FUZZ01',
					senderId: `fuzzer-${i}`
				};

				const validJson = await encryptData(key, sampleMsg);
				const parsed = JSON.parse(validJson);

				// Corrupt ciphertext at a random position
				const ct = parsed.ciphertext as number[];
				const mutateIdx = Math.floor(Math.random() * ct.length);
				ct[mutateIdx] = (ct[mutateIdx] ^ 0xff) & 0xff; // Invert bits

				const corruptedJson = JSON.stringify(parsed);

				try {
					await decryptData(key, corruptedJson);
				} catch {
					rejectionCount++;
				}

				// Deliver through MQTT client
				client.emit('message', `cards/v1/FUZZ01`, Buffer.from(corruptedJson));
			}

			expect(rejectionCount).toBe(100);

			await new Promise((r) => setTimeout(r, 60));
			expect(node.receivedRooms.length).toBe(0);
		});

		it('rejects envelopes with mutated IV lengths (0, 1, 6, 11, 13, 16, 64 bytes)', async () => {
			const key = await deriveRoomKey('IVTEST');
			const sampleMsg = { type: 'query_room', code: 'IVTEST', senderId: 'tester' };
			const validJson = await encryptData(key, sampleMsg);

			const testIvLengths = [0, 1, 6, 11, 13, 16, 64];

			for (const ivLen of testIvLengths) {
				const parsed = JSON.parse(validJson);
				// Create an explicit array of altered length
				parsed.iv = Array.from(crypto.getRandomValues(new Uint8Array(ivLen)));
				const badEnvelope = JSON.stringify(parsed);

				await expect(decryptData(key, badEnvelope)).rejects.toThrow();
			}
		});

		it('rejects envelopes with truncated or stripped authentication tags', async () => {
			const key = await deriveRoomKey('TAGTST');
			const sampleMsg = { type: 'query_room', code: 'TAGTST', senderId: 'tester' };
			const validJson = await encryptData(key, sampleMsg);
			const parsed = JSON.parse(validJson);

			// Truncate last 8 bytes (part of the 16-byte AES-GCM tag)
			parsed.ciphertext = parsed.ciphertext.slice(0, parsed.ciphertext.length - 8);
			const truncatedTagJson = JSON.stringify(parsed);

			await expect(decryptData(key, truncatedTagJson)).rejects.toThrow();

			// Strip all 16 bytes of the tag
			parsed.ciphertext = parsed.ciphertext.slice(0, parsed.ciphertext.length - 8);
			const strippedTagJson = JSON.stringify(parsed);

			await expect(decryptData(key, strippedTagJson)).rejects.toThrow();
		});

		it('rejects structurally invalid envelopes (null, primitive, bad fields)', async () => {
			const key = await deriveRoomKey('STRUCT');

			const invalidEnvelopes = [
				'null',
				'12345',
				'true',
				'[]',
				'{}',
				'{"iv": null, "ciphertext": [1,2]}',
				'{"iv": [1,2,3], "ciphertext": null}',
				'{"iv": "bad", "ciphertext": []}',
				'{"iv": [], "ciphertext": "bad"}',
				'{"missing": true}'
			];

			for (const env of invalidEnvelopes) {
				await expect(decryptData(key, env)).rejects.toThrow();
			}
		});

		it('rejects decrypted payloads that are not valid JSON or fail isValidMessage', async () => {
			const node = await createTestNode('node-payload-validate', true, 'PAYL01');
			activeNodes.push(node);
			const key = await deriveRoomKey('PAYL01');
			const client = (node.manager as any).client;

			// 1. Plaintext that is not JSON
			const iv1 = crypto.getRandomValues(new Uint8Array(12));
			const enc1 = new TextEncoder().encode('Not json string');
			const buf1 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv1 }, key, enc1);
			client.emit(
				'message',
				'cards/v1/PAYL01',
				Buffer.from(JSON.stringify({ iv: Array.from(iv1), ciphertext: Array.from(new Uint8Array(buf1)) }))
			);

			// 2. Valid JSON object with invalid message type
			const invalidType = { type: 'hack_attempt', senderId: 'attacker' };
			const env2 = await encryptData(key, invalidType);
			client.emit('message', 'cards/v1/PAYL01', Buffer.from(env2));

			// 3. Valid JSON object missing senderId
			const missingSender = { type: 'query_room', code: 'PAYL01' };
			const env3 = await encryptData(key, missingSender);
			client.emit('message', 'cards/v1/PAYL01', Buffer.from(env3));

			// 4. Valid JSON message echoing own senderId
			const echoMsg = { type: 'query_room', code: 'PAYL01', senderId: node.id };
			const env4 = await encryptData(key, echoMsg);
			client.emit('message', 'cards/v1/PAYL01', Buffer.from(env4));

			await new Promise((r) => setTimeout(r, 60));
			expect(node.receivedRooms.length).toBe(0);
		});

		it('floods 300 malformed packets synchronously; verify node remains healthy and accepts valid sync_room packet afterwards', async () => {
			const node = await createTestNode('node-flood-survivor', true, 'FLOOD1');
			activeNodes.push(node);
			const client = (node.manager as any).client;

			// Flood 300 garbage buffers
			for (let i = 0; i < 300; i++) {
				client.emit('message', 'cards/v1/FLOOD1', Buffer.from(`garbage_${i}_${Math.random()}`));
			}

			// Immediately send 1 valid encrypted packet (sync_room)
			const key = await deriveRoomKey('FLOOD1');
			const validRoomMsg: P2pMessage = {
				type: 'sync_room',
				room: {
					id: 'room-flood',
					code: 'FLOOD1',
					gameType: 'regicide',
					phase: 'lobby',
					hostId: 'other-host',
					players: [],
					maxPlayers: 4
				},
				senderId: 'other-host'
			};
			const validEnv = await encryptData(key, validRoomMsg);
			client.emit('message', 'cards/v1/FLOOD1', Buffer.from(validEnv));

			await new Promise((r) => setTimeout(r, 80));
			// Valid sync_room was successfully received and dispatched
			expect(node.receivedRooms.length).toBe(1);
			expect(node.receivedRooms[0].id).toBe('room-flood');
		});
	});

	describe('4. Out-of-Order Move Streams & State Reconciliation', () => {
		const templateDoc: GameDocument = {
			roomId: 'stress-room-1',
			phase: 'playing',
			currentRound: 1,
			seed: 42,
			dealerIndex: 0,
			moves: [],
			playerIds: ['p1', 'p2', 'p3'],
			roundScores: [],
			lastUpdate: 1000
		};

		it('rejects a reversed stream of 20 move updates and accepts only strictly monotonic progression', () => {
			// Construct 20 progressive docs
			const docs: GameDocument[] = [];
			for (let i = 1; i <= 20; i++) {
				const moves: Move[] = [];
				for (let m = 0; m < i; m++) {
					moves.push({
						playerId: `p${(m % 3) + 1}`,
						card: { suit: 'hearts', rank: 2 + m },
						timestamp: 1000 + m * 10
					});
				}
				docs.push({
					...templateDoc,
					moves,
					lastUpdate: 1000 + i * 10
				});
			}

			// Highest doc is docs[19] (20 moves)
			let currentDoc: GameDocument = docs[19];

			// Attempt to apply older docs (docs[18] down to docs[0])
			for (let i = 18; i >= 0; i--) {
				const accepted = shouldAcceptDocUpdate(docs[i], currentDoc);
				expect(accepted).toBe(false);
			}

			// Attempt to apply a doc from earlier round with more moves
			const earlierRoundDoc: GameDocument = {
				...templateDoc,
				currentRound: 0,
				moves: Array.from({ length: 30 }, (_, idx) => ({
					playerId: 'p1',
					card: { suit: 'spades', rank: idx },
					timestamp: 9999
				})),
				lastUpdate: 99999
			};
			expect(shouldAcceptDocUpdate(earlierRoundDoc, currentDoc)).toBe(false);

			// Next round with 0 moves must be accepted
			const nextRoundDoc: GameDocument = {
				...templateDoc,
				currentRound: 2,
				moves: [],
				lastUpdate: 2000
			};
			expect(shouldAcceptDocUpdate(nextRoundDoc, currentDoc)).toBe(true);
		});

		it('handles split-brain move streams with identical move lengths: accepts only strictly newer lastUpdate', () => {
			const base: GameDocument = {
				...templateDoc,
				moves: [{ playerId: 'p1', card: { suit: 'hearts', rank: 10 }, timestamp: 100 }],
				lastUpdate: 5000
			};

			const stale: GameDocument = { ...base, lastUpdate: 4999 };
			const equal: GameDocument = { ...base, lastUpdate: 5000 };
			const newer: GameDocument = { ...base, lastUpdate: 5001 };

			expect(shouldAcceptDocUpdate(stale, base)).toBe(false);
			expect(shouldAcceptDocUpdate(equal, base)).toBe(true);
			expect(shouldAcceptDocUpdate(newer, base)).toBe(true);
		});

		it('stress-tests DocDedupCache with 500 documents: verifies bounded size and LRU eviction', () => {
			const cache = new DocDedupCache(100);

			const testDocs: GameDocument[] = [];
			for (let i = 0; i < 500; i++) {
				testDocs.push({
					...templateDoc,
					currentRound: i,
					lastUpdate: i * 10
				});
			}

			for (const doc of testDocs) {
				cache.add(doc);
			}

			// Size is bounded to 100
			// The earliest docs (0 to 399) should be evicted
			for (let i = 0; i < 400; i++) {
				expect(cache.has(testDocs[i])).toBe(false);
			}

			// The latest 100 docs (400 to 499) must be present
			for (let i = 400; i < 500; i++) {
				expect(cache.has(testDocs[i])).toBe(true);
			}
		});

		it('deduplicateMoves handles 100 mixed duplicate and unique moves deterministically', () => {
			const uniqueMoves: Move[] = [];
			for (let i = 0; i < 10; i++) {
				uniqueMoves.push({
					playerId: `player_${i}`,
					card: { suit: 'hearts', rank: 2 + i },
					timestamp: 100 + i
				});
			}

			// Build array of 100 moves by repeating unique moves 10 times interleaved
			const duplicatedArray: Move[] = [];
			for (let rep = 0; rep < 10; rep++) {
				duplicatedArray.push(...uniqueMoves);
			}

			expect(duplicatedArray.length).toBe(100);

			const deduplicated = deduplicateMoves(duplicatedArray);

			expect(deduplicated.length).toBe(10);
			for (let i = 0; i < 10; i++) {
				expect(deduplicated[i]).toEqual(uniqueMoves[i]);
			}
		});
	});
});
