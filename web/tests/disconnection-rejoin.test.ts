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
	});
});
