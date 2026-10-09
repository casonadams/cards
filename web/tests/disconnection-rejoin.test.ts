import { describe, expect, it } from 'bun:test';
import {
	getAiCurrentId,
	executeSingleSkipTurn,
	shouldDestroyRoomOnHostLeave,
	shouldPruneActiveSession
} from '$lib/room/room-helpers';
import { shouldRunOhWellAiBid } from '$lib/room/oh-well-helpers';
import { setupTrickTakingAi, setupOhWellAiBid } from '$lib/room/ai-effects';
import type { GameRoom, RoomPlayer, GameRuntime, Card } from '$lib/platform/types/index';
import type { DerivedGameState } from '$lib/platform/stores/game-store';
import type { GameDocument } from '$lib/platform/engine/index';
import { getGame } from '$lib/platform/engine/index';
import { registerAllGames } from '$lib/games/register-all';

registerAllGames();

describe('Disconnection & Rejoin Management', () => {
	const mockPlayers: RoomPlayer[] = [
		{ id: 'player-host', displayName: 'Host Player', isHost: true, isConnected: true, lastSeen: 1000 },
		{ id: 'player-bob', displayName: 'Bob', isHost: false, isConnected: true, lastSeen: 1000 },
		{ id: 'ai-0', displayName: 'Bot Alice', isHost: false, isConnected: true, lastSeen: 1000 }
	];

	const mockRoom: GameRoom = {
		id: 'room-1',
		code: 'TESTME',
		hostId: 'player-host',
		gameDefinitionId: 'oh-well',
		maxPlayers: 3,
		players: mockPlayers,
		playerIds: ['player-host', 'player-bob', 'ai-0'],
		phase: 'playing',
		createdAt: 1000
	};

	describe('AI Takeover via isAiControlled flag', () => {
		it('returns null for human player when isAiControlled is false or omitted', () => {
			const gs = { currentTurnIndex: 1 } as unknown as DerivedGameState; // points to player-bob
			const result = getAiCurrentId(mockRoom.playerIds, gs, mockRoom);
			expect(result).toBeNull();
		});

		it('returns player ID for normal bot player', () => {
			const gs = { currentTurnIndex: 2 } as unknown as DerivedGameState; // points to ai-0
			const result = getAiCurrentId(mockRoom.playerIds, gs, mockRoom);
			expect(result).toBe('ai-0');
		});

		it('returns player ID for human player when isAiControlled is true', () => {
			const roomWithAiBob: GameRoom = {
				...mockRoom,
				players: [
					mockPlayers[0],
					{ ...mockPlayers[1], isConnected: false, isAiControlled: true },
					mockPlayers[2]
				]
			};
			const gs = { currentTurnIndex: 1 } as unknown as DerivedGameState;
			const result = getAiCurrentId(roomWithAiBob.playerIds, gs, roomWithAiBob);
			expect(result).toBe('player-bob');
		});

		it('shouldRunOhWellAiBid triggers for human player when isAiControlled is true', () => {
			const roomWithAiBob: GameRoom = {
				...mockRoom,
				players: [
					mockPlayers[0],
					{ ...mockPlayers[1], isConnected: false, isAiControlled: true },
					mockPlayers[2]
				]
			};

			const doc = {
				playerIds: ['player-host', 'player-bob', 'ai-0'],
				gameSpecific: {
					currentRound: 1,
					bids: { 'player-host': 1 },
					dealerIndex: 0,
					currentBidder: 1 // player-bob
				}
			} as unknown as GameDocument;

			const gs = {
				isRoundComplete: false,
				gameSpecific: {
					phase: 'bidding'
				}
			} as unknown as DerivedGameState;

			const canBidNormal = shouldRunOhWellAiBid({
				isHost: true,
				doc,
				gs,
				room: mockRoom
			});
			expect(canBidNormal).toBe(false);

			const canBidAi = shouldRunOhWellAiBid({
				isHost: true,
				doc,
				gs,
				room: roomWithAiBob
			});
			expect(canBidAi).toBe(true);
		});

		it('returns null for human player even if isAiControlled is true when isConnected is true', () => {
			const roomWithConnectedAiBob: GameRoom = {
				...mockRoom,
				players: [
					mockPlayers[0],
					{ ...mockPlayers[1], isConnected: true, isAiControlled: true },
					mockPlayers[2]
				]
			};
			const gs = { currentTurnIndex: 1 } as unknown as DerivedGameState;
			const result = getAiCurrentId(roomWithConnectedAiBob.playerIds, gs, roomWithConnectedAiBob);
			expect(result).toBeNull();
		});

		it('shouldRunOhWellAiBid returns false for connected human player even if isAiControlled is true', () => {
			const roomWithConnectedAiBob: GameRoom = {
				...mockRoom,
				players: [
					mockPlayers[0],
					{ ...mockPlayers[1], isConnected: true, isAiControlled: true },
					mockPlayers[2]
				]
			};

			const doc = {
				playerIds: ['player-host', 'player-bob', 'ai-0'],
				gameSpecific: {
					currentRound: 1,
					bids: { 'player-host': 1 },
					dealerIndex: 0,
					currentBidder: 1
				}
			} as unknown as GameDocument;

			const gs = {
				isRoundComplete: false,
				gameSpecific: {
					phase: 'bidding'
				}
			} as unknown as DerivedGameState;

			const canBid = shouldRunOhWellAiBid({
				isHost: true,
				doc,
				gs,
				room: roomWithConnectedAiBob
			});
			expect(canBid).toBe(false);
		});
	});

	describe('Host Skip Turn Execution', () => {
		it('executes a single legal move via the game runtime and dispatches playCard', async () => {
			const runtime = getGame('canadian-salad');
			expect(runtime).toBeDefined();

			const testPlayerIds = ['player-host', 'player-bob', 'player-charlie', 'player-dave'];
			const deal = runtime.deal(4, 12345);

			const doc: GameDocument = {
				id: 'doc-1',
				gameId: 'canadian-salad',
				currentRound: 0,
				dealerIndex: 0,
				playerIds: testPlayerIds,
				hands: {
					'player-host': deal.hands[0],
					'player-bob': deal.hands[1],
					'player-charlie': deal.hands[2],
					'player-dave': deal.hands[3]
				},
				trick: [],
				completedTricks: [],
				scores: [],
				moves: [],
				roundState: 'playing',
				lastUpdate: Date.now(),
				seed: 12345
			};

			let playedCard: Card | null = null;
			let playedPlayerId: string | null = null;

			const success = await executeSingleSkipTurn({
				runtime: runtime as unknown as GameRuntime,
				doc,
				playerIds: testPlayerIds,
				currentId: 'player-bob',
				actions: {
					playCard: async ({ playerId, card }) => {
						playedPlayerId = playerId;
						playedCard = card;
					}
				}
			});

			expect(success).toBe(true);
			expect(playedPlayerId).toBe('player-bob');
			expect(playedCard).not.toBeNull();
			// Ensure played card belonged to player-bob's initial hand
			const bobHand = deal.hands[1] || [];
			expect(bobHand.some((c) => c.suit === playedCard!.suit && c.rank === playedCard!.rank)).toBe(true);
		});
	});

	describe('Reconnection & State Restoration', () => {
		it('resets isConnected to true and clears isAiControlled on join_request', () => {
			// Simulate initial state where bob was disconnected and had AI turned on
			const initialRoom: GameRoom = {
				...mockRoom,
				players: [
					mockPlayers[0],
					{ ...mockPlayers[1], isConnected: false, isAiControlled: true },
					mockPlayers[2]
				]
			};

			// Reconnection payload from Bob
			const rejoiningBob: RoomPlayer = {
				id: 'player-bob',
				displayName: 'Bob (Phone)',
				isHost: false,
				isConnected: true,
				lastSeen: 2000
			};

			// Re-apply same logic as onJoinRequest
			const existingIndex = initialRoom.players.findIndex((p) => p.id === rejoiningBob.id);
			expect(existingIndex).toBe(1);

			const updatedPlayers = [...initialRoom.players];
			updatedPlayers[existingIndex] = {
				...initialRoom.players[existingIndex],
				displayName: rejoiningBob.displayName,
				isConnected: true,
				lastSeen: Date.now(),
				isAiControlled: false // Cleared!
			};

			expect(updatedPlayers[1].isConnected).toBe(true);
			expect(updatedPlayers[1].isAiControlled).toBe(false);
			expect(updatedPlayers[1].displayName).toBe('Bob (Phone)');
		});

		it('advances rejoining client from stale doc to live authoritative doc when AI took turns', () => {
			const runtime = getGame('canadian-salad');
			const testPlayerIds = ['player-host', 'player-bob', 'player-charlie', 'player-dave'];
			const seed = 42;

			// Deal hands
			const deal = runtime.deal(4, seed);
			const hostCard1 = deal.hands[0][0];
			const bobCard1 = deal.hands[1][0];

			// Stale doc on Bob's phone when Bob disconnected mid-trick 1:
			const bobStaleDoc: GameDocument = {
				roomId: 'room-1',
				phase: 'playing',
				currentRound: 0,
				seed,
				dealerIndex: 0,
				playerIds: testPlayerIds,
				roundScores: [],
				moves: [
					{ playerId: 'player-host', card: hostCard1, timestamp: 1000 }
				],
				lastUpdate: 1000
			};

			// Derive state on Bob's phone before catch-up: Bob only sees host's 1 card
			const staleGs = runtime.deriveState({
				moves: bobStaleDoc.moves,
				seed: bobStaleDoc.seed,
				currentRound: bobStaleDoc.currentRound,
				playerCount: 4,
				playerIds: testPlayerIds,
				myId: 'player-bob',
				dealerIndex: 0
			});
			expect(staleGs.trickPlays.length).toBe(1);
			expect(staleGs.lastCompleteTrick.length).toBe(0);
			expect(staleGs.lastTrickWinnerId).toBeNull();

			// While Bob was away, AI played for Bob, Charlie, and Dave, finishing trick 1:
			const charlieCard1 = deal.hands[2][0];
			const daveCard1 = deal.hands[3][0];
			const liveAuthoritativeDoc: GameDocument = {
				roomId: 'room-1',
				phase: 'playing',
				currentRound: 0,
				seed,
				dealerIndex: 0,
				playerIds: testPlayerIds,
				roundScores: [],
				moves: [
					{ playerId: 'player-host', card: hostCard1, timestamp: 1000 },
					{ playerId: 'player-bob', card: bobCard1, timestamp: 1001 },
					{ playerId: 'player-charlie', card: charlieCard1, timestamp: 1002 },
					{ playerId: 'player-dave', card: daveCard1, timestamp: 1003 }
				],
				lastUpdate: 1005
			};

			// 1. Should accept doc update from host
			const { shouldAcceptDocUpdate } = require('$lib/platform/engine/game-sync');
			expect(shouldAcceptDocUpdate(liveAuthoritativeDoc, bobStaleDoc)).toBe(true);

			// 2. Derive state on Bob's phone after receiving liveAuthoritativeDoc
			const caughtUpGs = runtime.deriveState({
				moves: liveAuthoritativeDoc.moves,
				seed: liveAuthoritativeDoc.seed,
				currentRound: liveAuthoritativeDoc.currentRound,
				playerCount: 4,
				playerIds: testPlayerIds,
				myId: 'player-bob',
				dealerIndex: 0
			});

			// Bob's UI is now 100% caught up to the live table!
			expect(caughtUpGs.lastCompleteTrick.length).toBe(4);
			expect(caughtUpGs.lastTrickWinnerId).not.toBeNull();
			expect(caughtUpGs.trickPlays.length).toBe(0);
			// Bob's remaining hand excludes bobCard1 which AI played
			expect(caughtUpGs.myRemainingHand.some((c: Card) => c.suit === bobCard1.suit && c.rank === bobCard1.rank)).toBe(false);
			expect(caughtUpGs.myRemainingHand.length).toBe(deal.hands[1].length - 1);

			// 3. Stale move rejection test: verify that playing against the stale doc would have failed
			const staleAttemptDoc: GameDocument = {
				...bobStaleDoc,
				moves: [...bobStaleDoc.moves, { playerId: 'player-bob', card: bobCard1, timestamp: 2000 }],
				lastUpdate: 2000
			};
			// Host comparing incoming stale attempt (length 2) against host's live doc (length 4) correctly rejects it
			expect(shouldAcceptDocUpdate(staleAttemptDoc, liveAuthoritativeDoc)).toBe(false);

			// 4. Playing against caughtUp doc succeeds: Bob plays next card
			const bobCard2 = caughtUpGs.myRemainingHand[0];
			const validNextDoc: GameDocument = {
				...liveAuthoritativeDoc,
				moves: [...liveAuthoritativeDoc.moves, { playerId: 'player-bob', card: bobCard2, timestamp: 2000 }],
				lastUpdate: 2000
			};
			expect(shouldAcceptDocUpdate(validNextDoc, liveAuthoritativeDoc)).toBe(true);
		});

		it('clears isAiControlled when peer reconnects via onPeerConnectionChange', () => {
			const initialRoom: GameRoom = {
				...mockRoom,
				players: [
					mockPlayers[0],
					{ ...mockPlayers[1], isConnected: false, isAiControlled: true },
					mockPlayers[2]
				]
			};

			// Reconnection handler logic from onPeerConnectionChange
			const peerId = 'player-bob';
			const isConnected = true;
			const updatedPlayers = initialRoom.players.map((p) =>
				p.id === peerId
					? {
							...p,
							isConnected,
							lastSeen: Date.now(),
							isAiControlled: isConnected ? false : p.isAiControlled
					  }
					: p
			);

			expect(updatedPlayers[1].isConnected).toBe(true);
			expect(updatedPlayers[1].isAiControlled).toBe(false);
		});

		it('cancels scheduled in-flight AI move if human player reconnects before timer fires', async () => {
			const runtime = getGame('canadian-salad')!;
			let liveRoom: GameRoom = {
				...mockRoom,
				players: [
					mockPlayers[0],
					{ ...mockPlayers[1], isConnected: false, isAiControlled: true },
					mockPlayers[2]
				]
			};

			let playedCard: Card | null = null;
			const mockActions = {
				playCard: async (args: { card: Card }) => {
					playedCard = args.card;
				}
			};

			const testDoc: GameDocument = {
				id: 'doc-cancel-test',
				gameId: 'canadian-salad',
				roomId: 'room-1',
				phase: 'playing',
				currentRound: 0,
				seed: 42,
				dealerIndex: 0,
				playerIds: mockRoom.playerIds,
				roundScores: [],
				moves: [],
				lastUpdate: 1000
			};

			const gs = {
				currentTurnIndex: 1, // player-bob
				trickPlays: [],
				lastCompleteTrick: [],
				isRoundComplete: false
			} as unknown as DerivedGameState;

			const cleanup = setupTrickTakingAi({
				isHost: true,
				gameDoc: testDoc,
				gs,
				playerIds: mockRoom.playerIds,
				runtime,
				actions: mockActions as any,
				room: liveRoom,
				getRoom: () => liveRoom,
				isOhWell: false
			});

			// Human player reconnects mid-timer!
			liveRoom = {
				...liveRoom,
				players: [
					mockPlayers[0],
					{ ...mockPlayers[1], isConnected: true, isAiControlled: false },
					mockPlayers[2]
				]
			};

			// Wait past AI delay (500ms)
			await new Promise((resolve) => setTimeout(resolve, 600));
			cleanup?.();

			// Card was NOT played because in-flight guard detected reconnected human!
			expect(playedCard).toBeNull();
		});

		it('cancels scheduled in-flight Oh Well AI bid if human player reconnects before timer fires', async () => {
			let liveRoom: GameRoom = {
				...mockRoom,
				players: [
					mockPlayers[0],
					{ ...mockPlayers[1], isConnected: false, isAiControlled: true },
					mockPlayers[2]
				]
			};

			let updatedDoc: GameDocument | null = null;
			const mockActions = {
				updateGameState: async (doc: GameDocument) => {
					updatedDoc = doc;
				}
			};

			const doc = {
				playerIds: ['player-host', 'player-bob', 'ai-0'],
				gameSpecific: {
					currentRound: 1,
					bids: { 'player-host': 1 },
					dealerIndex: 0,
					currentBidder: 1 // player-bob
				}
			} as unknown as GameDocument;

			const gs = {
				isRoundComplete: false,
				gameSpecific: {
					phase: 'bidding'
				}
			} as unknown as DerivedGameState;

			const cleanup = setupOhWellAiBid({
				isHost: true,
				gameDoc: doc,
				gs,
				playerIds: mockRoom.playerIds,
				runtime: null,
				actions: mockActions as any,
				room: liveRoom,
				getRoom: () => liveRoom
			});

			// Human player reconnects mid-timer!
			liveRoom = {
				...liveRoom,
				players: [
					mockPlayers[0],
					{ ...mockPlayers[1], isConnected: true, isAiControlled: false },
					mockPlayers[2]
				]
			};

			// Wait past Oh Well bid delay (800ms)
			await new Promise((resolve) => setTimeout(resolve, 900));
			cleanup?.();

			// Bid was NOT placed because in-flight guard detected reconnected human!
			expect(updatedDoc).toBeNull();
		});
	});

	describe('Host Handoff & Temporary Host Grace Period', () => {
		const fourPlayers: RoomPlayer[] = [
			{ id: 'host-alice', displayName: 'Alice (Host)', isHost: true, isConnected: true, lastSeen: 1000 },
			{ id: 'player-bob', displayName: 'Bob', isHost: false, isConnected: true, lastSeen: 1000 },
			{ id: 'player-charlie', displayName: 'Charlie', isHost: false, isConnected: true, lastSeen: 1000 },
			{ id: 'ai-0', displayName: 'Bot Dave', isHost: false, isConnected: true, lastSeen: 1000 }
		];

		const activeRoom: GameRoom = {
			id: 'room-4p',
			code: 'FOURPL',
			hostId: 'host-alice',
			gameDefinitionId: 'canadian-salad',
			maxPlayers: 4,
			players: fourPlayers,
			playerIds: ['host-alice', 'player-bob', 'player-charlie', 'ai-0'],
			phase: 'playing',
			createdAt: 1000
		};

		it('elects the next connected human as temporary host when host disconnects', () => {
			const { isAiPlayer } = require('$lib/platform/engine/ai-player');
			// Alice disconnects
			const disconnectedPlayers = activeRoom.players.map((p) =>
				p.id === 'host-alice' ? { ...p, isConnected: false, lastSeen: Date.now() } : p
			);

			// Find next connected human
			const candidate = disconnectedPlayers.find(
				(p) => p.id !== activeRoom.hostId && p.isConnected && !isAiPlayer(p.id)
			);
			expect(candidate).toBeDefined();
			expect(candidate?.id).toBe('player-bob');

			// Temporary host election
			const tempHostRoom: GameRoom = {
				...activeRoom,
				players: disconnectedPlayers,
				tempHostId: candidate!.id,
				hostDisconnectedAt: Date.now()
			};

			expect(tempHostRoom.tempHostId).toBe('player-bob');
			expect(tempHostRoom.hostId).toBe('host-alice');
		});

		it('reclaims primary host when original host reconnects within 30 seconds', () => {
			const now = Date.now();
			const tempHostRoom: GameRoom = {
				...activeRoom,
				players: [
					{ ...fourPlayers[0], isConnected: false },
					fourPlayers[1],
					fourPlayers[2],
					fourPlayers[3]
				],
				tempHostId: 'player-bob',
				hostDisconnectedAt: now - 15000 // Disconnected 15s ago (< 30s)
			};

			// Reclaiming join request from Alice
			const rejoiningAlice: RoomPlayer = {
				id: 'host-alice',
				displayName: 'Alice (Host)',
				isHost: true,
				isConnected: true,
				lastSeen: now
			};

			const isOriginalHostReclaiming = rejoiningAlice.id === tempHostRoom.hostId;
			expect(isOriginalHostReclaiming).toBe(true);

			const updatedPlayers = tempHostRoom.players.map((p) =>
				p.id === rejoiningAlice.id
					? { ...p, isConnected: true, isHost: true }
					: p
			);

			const restoredRoom: GameRoom = {
				...tempHostRoom,
				players: updatedPlayers,
				tempHostId: undefined, // Cleared!
				hostDisconnectedAt: undefined // Cleared!
			};

			expect(restoredRoom.hostId).toBe('host-alice');
			expect(restoredRoom.tempHostId).toBeUndefined();
			expect(restoredRoom.players.find((p) => p.id === 'host-alice')?.isHost).toBe(true);
		});

		it('promotes temporary host to permanent host when 30 seconds expire', () => {
			const now = Date.now();
			const tempHostRoom: GameRoom = {
				...activeRoom,
				players: [
					{ ...fourPlayers[0], isConnected: false },
					fourPlayers[1],
					fourPlayers[2],
					fourPlayers[3]
				],
				tempHostId: 'player-bob',
				hostDisconnectedAt: now - 35000 // Disconnected 35s ago (> 30s)
			};

			const elapsed = now - tempHostRoom.hostDisconnectedAt!;
			expect(elapsed).toBeGreaterThanOrEqual(30000);

			// Permanent promotion executed by Bob
			const promotedPlayers = tempHostRoom.players.map((p) => {
				if (p.id === tempHostRoom.tempHostId) return { ...p, isHost: true };
				if (p.id === tempHostRoom.hostId) return { ...p, isHost: false };
				return p;
			});

			const permanentlyPromotedRoom: GameRoom = {
				...tempHostRoom,
				hostId: tempHostRoom.tempHostId!,
				tempHostId: undefined,
				hostDisconnectedAt: undefined,
				players: promotedPlayers
			};

			expect(permanentlyPromotedRoom.hostId).toBe('player-bob');
			expect(permanentlyPromotedRoom.tempHostId).toBeUndefined();
			expect(permanentlyPromotedRoom.players.find((p) => p.id === 'player-bob')?.isHost).toBe(true);
			expect(permanentlyPromotedRoom.players.find((p) => p.id === 'host-alice')?.isHost).toBe(false);

			// If Alice reconnects later, she joins as a regular player
			const lateAliceJoin: RoomPlayer = {
				id: 'host-alice',
				displayName: 'Alice',
				isHost: false,
				isConnected: true,
				lastSeen: now + 5000
			};
			const isAliceReclaiming = lateAliceJoin.id === permanentlyPromotedRoom.hostId;
			expect(isAliceReclaiming).toBe(false); // Alice is no longer the room's hostId
		});
	});

	describe('Host Departure & Zombie Room Destruction', () => {
		const hostAlice: RoomPlayer = {
			id: 'host-alice',
			displayName: 'Alice',
			isHost: true,
			isConnected: true,
			lastSeen: 1000
		};
		const botBob: RoomPlayer = {
			id: 'ai-0',
			displayName: 'Bot Bob',
			isHost: false,
			isConnected: true,
			lastSeen: 1000
		};
		const botCharlie: RoomPlayer = {
			id: 'ai-1',
			displayName: 'Bot Charlie',
			isHost: false,
			isConnected: true,
			lastSeen: 1000
		};
		const humanDan: RoomPlayer = {
			id: 'player-dan',
			displayName: 'Dan',
			isHost: false,
			isConnected: true,
			lastSeen: 1000
		};

		it('kills room when host leaves and all other players are AI bots', () => {
			const roomWithOnlyBots: GameRoom = {
				id: 'room-bots-only',
				code: 'BOTS01',
				hostId: 'host-alice',
				gameDefinitionId: 'oh-well',
				maxPlayers: 3,
				players: [hostAlice, botBob, botCharlie],
				playerIds: ['host-alice', 'ai-0', 'ai-1'],
				phase: 'playing',
				createdAt: 1000
			};

			const shouldDestroy = shouldDestroyRoomOnHostLeave(roomWithOnlyBots, 'host-alice', true);
			expect(shouldDestroy).toBe(true);
		});

		it('kills room when host leaves and all other human players have disconnected (only AI bots left)', () => {
			const roomWithDisconnectedHuman: GameRoom = {
				id: 'room-dc-human',
				code: 'DCHUM1',
				hostId: 'host-alice',
				gameDefinitionId: 'oh-well',
				maxPlayers: 4,
				players: [
					hostAlice,
					{ ...humanDan, isConnected: false, isAiControlled: true },
					botBob,
					botCharlie
				],
				playerIds: ['host-alice', 'player-dan', 'ai-0', 'ai-1'],
				phase: 'playing',
				createdAt: 1000
			};

			const shouldDestroy = shouldDestroyRoomOnHostLeave(roomWithDisconnectedHuman, 'host-alice', true);
			expect(shouldDestroy).toBe(true);
		});

		it('does NOT kill room when host leaves if another connected human player remains', () => {
			const roomWithConnectedHuman: GameRoom = {
				id: 'room-conn-human',
				code: 'CONNH1',
				hostId: 'host-alice',
				gameDefinitionId: 'oh-well',
				maxPlayers: 4,
				players: [hostAlice, humanDan, botBob, botCharlie],
				playerIds: ['host-alice', 'player-dan', 'ai-0', 'ai-1'],
				phase: 'playing',
				createdAt: 1000
			};

			const shouldDestroy = shouldDestroyRoomOnHostLeave(roomWithConnectedHuman, 'host-alice', true);
			expect(shouldDestroy).toBe(false);
		});

		it('does NOT kill room when a non-host guest leaves', () => {
			const roomWithGuest: GameRoom = {
				id: 'room-guest',
				code: 'GUEST1',
				hostId: 'host-alice',
				gameDefinitionId: 'oh-well',
				maxPlayers: 4,
				players: [hostAlice, humanDan, botBob, botCharlie],
				playerIds: ['host-alice', 'player-dan', 'ai-0', 'ai-1'],
				phase: 'playing',
				createdAt: 1000
			};

			const shouldDestroy = shouldDestroyRoomOnHostLeave(roomWithGuest, 'player-dan', false);
			expect(shouldDestroy).toBe(false);
		});

		it('kills room when temporary acting host leaves with only AI bots remaining', () => {
			const roomWithActingHost: GameRoom = {
				id: 'room-acting-host',
				code: 'ACTING',
				hostId: 'host-alice',
				tempHostId: 'player-dan',
				gameDefinitionId: 'oh-well',
				maxPlayers: 3,
				players: [
					{ ...hostAlice, isConnected: false },
					{ ...humanDan, isHost: false },
					botBob
				],
				playerIds: ['host-alice', 'player-dan', 'ai-0'],
				phase: 'playing',
				createdAt: 1000
			};

			const shouldDestroy = shouldDestroyRoomOnHostLeave(roomWithActingHost, 'player-dan', true);
			expect(shouldDestroy).toBe(true);
		});

		it('prunes active session when room is null or gameOver or has only AI bots left for host', () => {
			// Null room for host -> prune
			expect(shouldPruneActiveSession(null, 'host-alice', 'host-alice')).toBe(true);

			// Null room for remote guest -> do NOT prune
			expect(shouldPruneActiveSession(null, 'player-dan', 'host-alice')).toBe(false);

			// Game over room -> prune for both host and guest
			const gameOverRoom: GameRoom = {
				id: 'room-ended',
				code: 'ENDED1',
				hostId: 'host-alice',
				gameDefinitionId: 'oh-well',
				maxPlayers: 3,
				players: [],
				playerIds: [],
				phase: 'gameOver',
				createdAt: 1000
			};
			expect(shouldPruneActiveSession(gameOverRoom, 'host-alice')).toBe(true);
			expect(shouldPruneActiveSession(gameOverRoom, 'player-dan')).toBe(true);

			// Bot-only abandoned room -> host checking session must prune!
			const botOnlyRoom: GameRoom = {
				id: 'room-bots',
				code: 'BOTS02',
				hostId: 'host-alice',
				gameDefinitionId: 'oh-well',
				maxPlayers: 3,
				players: [
					{ ...hostAlice, isConnected: false },
					botBob,
					botCharlie
				],
				playerIds: ['host-alice', 'ai-0', 'ai-1'],
				phase: 'playing',
				createdAt: 1000
			};
			expect(shouldPruneActiveSession(botOnlyRoom, 'host-alice')).toBe(true);

			// Live room with connected human -> must NOT prune
			const liveRoom: GameRoom = {
				id: 'room-live',
				code: 'LIVE01',
				hostId: 'host-alice',
				gameDefinitionId: 'oh-well',
				maxPlayers: 3,
				players: [
					{ ...hostAlice, isConnected: false },
					humanDan,
					botBob
				],
				playerIds: ['host-alice', 'player-dan', 'ai-0'],
				phase: 'playing',
				createdAt: 1000
			};
			expect(shouldPruneActiveSession(liveRoom, 'player-dan')).toBe(false);
		});
	});
});
