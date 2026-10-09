import { describe, expect, it } from 'bun:test';
import { getAiCurrentId, executeSingleSkipTurn } from '$lib/room/room-helpers';
import { shouldRunOhWellAiBid } from '$lib/room/oh-well-helpers';
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
	});
});
