import { describe, expect, it } from 'bun:test';
import {
	BROKER_URLS,
	STUN_SERVERS,
	deriveRoomKey,
	encryptData,
	decryptData,
	isValidMessage,
	WebRtcPeer,
	type P2pMessage
} from '$lib/platform/adapters/p2p-webrtc.ts';

describe('P2P Network Primitives & Crypto', () => {
	it('defines multi-broker failover pool and STUN configuration', () => {
		expect(BROKER_URLS.length).toBeGreaterThanOrEqual(3);
		expect(BROKER_URLS).toContain('wss://test.mosquitto.org:8081');
		expect(BROKER_URLS).toContain('wss://broker.emqx.io:8084/mqtt');
		expect(BROKER_URLS).toContain('wss://broker.hivemq.com:8884/mqtt');

		expect(STUN_SERVERS.length).toBeGreaterThanOrEqual(2);
		expect(STUN_SERVERS[0].urls).toContain('stun.l.google.com');
	});

	it('derives deterministic 256-bit AES-GCM key from room code regardless of case or whitespace', async () => {
		const key1 = await deriveRoomKey('ab12cd');
		const key2 = await deriveRoomKey('  AB12CD  ');
		expect(key1).toBeDefined();
		expect(key2).toBeDefined();
		expect(key1.algorithm.name).toBe('AES-GCM');

		const rawData = { hello: 'cards-p2p' };
		const encrypted = await encryptData(key1, rawData);
		const decrypted = await decryptData(key2, encrypted);
		expect(decrypted).toEqual(rawData);
	});

	it('encrypts data into unique IV envelopes and decrypts back accurately', async () => {
		const key = await deriveRoomKey('ROOM99');
		const sampleDoc = {
			roomId: 'room-1',
			moves: [{ playerId: 'p1', card: { suit: 'hearts', rank: 14 }, timestamp: 100 }],
			currentRound: 2
		};

		const env1 = await encryptData(key, sampleDoc);
		const env2 = await encryptData(key, sampleDoc);

		// Different IVs mean different ciphertexts for the same plaintext
		expect(env1).not.toBe(env2);

		const parsed1 = JSON.parse(env1);
		expect(Array.isArray(parsed1.iv)).toBe(true);
		expect(parsed1.iv.length).toBe(12);
		expect(Array.isArray(parsed1.ciphertext)).toBe(true);

		const decrypted = (await decryptData(key, env1)) as typeof sampleDoc;
		expect(decrypted).toEqual(sampleDoc);
	});

	it('fails to decrypt with incorrect room key or malformed envelope', async () => {
		const keyCorrect = await deriveRoomKey('TABLE1');
		const keyWrong = await deriveRoomKey('TABLE2');

		const secret = { trump: 'spades' };
		const encrypted = await encryptData(keyCorrect, secret);

		let failed = false;
		try {
			await decryptData(keyWrong, encrypted);
		} catch {
			failed = true;
		}
		expect(failed).toBe(true);

		// Malformed JSON envelope
		let malformedFailed = false;
		try {
			await decryptData(keyCorrect, '{"notAnEnvelope": true}');
		} catch {
			malformedFailed = true;
		}
		expect(malformedFailed).toBe(true);
	});

	it('validates all supported P2P and signaling message types', () => {
		const validMessages: P2pMessage[] = [
			{ type: 'query_room', code: 'ABCDEF', senderId: 'user-1' },
			{
				type: 'join_request',
				code: 'ABCDEF',
				player: { id: 'user-2', displayName: 'Player 2', isConnected: true, lastSeen: 1 },
				senderId: 'user-2'
			},
			{
				type: 'sync_room',
				room: {
					id: 'r1',
					code: 'ABCDEF',
					gameDefinitionId: 'oh-well',
					hostId: 'user-1',
					maxPlayers: 4,
					players: [],
					playerIds: [],
					phase: 'lobby',
					createdAt: 1
				},
				senderId: 'user-1'
			},
			{
				type: 'sync_doc',
				roomId: 'r1',
				doc: { id: 'd1', gameDefinitionId: 'oh-well', seed: 42, moves: [], currentRound: 0 },
				senderId: 'user-1'
			},
			{ type: 'query_doc', roomId: 'r1', senderId: 'user-2' },
			{
				type: 'signal_offer',
				targetId: 'user-1',
				offer: { type: 'offer', sdp: 'dummy-offer-sdp' },
				senderId: 'user-2'
			},
			{
				type: 'signal_answer',
				targetId: 'user-2',
				answer: { type: 'answer', sdp: 'dummy-answer-sdp' },
				senderId: 'user-1'
			},
			{
				type: 'signal_ice',
				targetId: 'user-1',
				candidate: { candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0 },
				senderId: 'user-2'
			},
			{ type: 'ping', senderId: 'user-1', timestamp: 12345 },
			{ type: 'pong', senderId: 'user-2', timestamp: 12345 }
		];

		for (const msg of validMessages) {
			expect(isValidMessage(msg)).toBe(true);
		}

		// Invalid cases
		expect(isValidMessage(null)).toBe(false);
		expect(isValidMessage({})).toBe(false);
		expect(isValidMessage({ type: 'unknown_type', senderId: 'user-1' })).toBe(false);
		expect(isValidMessage({ type: 'ping' })).toBe(false); // missing senderId
	});

	it('initializes WebRtcPeer and gracefully handles non-browser runtimes', () => {
		let signalSent = false;
		let stateChanged = false;
		const peer = new WebRtcPeer(
			'remote-peer-1',
			() => {
				signalSent = true;
			},
			() => {},
			() => {
				stateChanged = true;
			}
		);

		expect(peer.remotePeerId).toBe('remote-peer-1');
		expect(peer.isOpen).toBe(false);
		expect(signalSent).toBe(false);
		expect(stateChanged).toBe(false);

		peer.close();
		expect(peer.isOpen).toBe(false);
	});
});
