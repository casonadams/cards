import { describe, expect, it } from 'bun:test';
import { computeOhWellAiMove } from '$lib/games/oh-well/ai.ts';

describe('oh well ai simulation', () => {
	const playerIds = ['player-0', 'ai-1', 'player-2', 'player-3'];
	const seed = 12345;

	it('returns null when phase is not playing or not AI turn', () => {
		const move = computeOhWellAiMove({
			moves: [],
			seed,
			currentRound: 0,
			playerCount: 4,
			playerIds,
			aiPlayerId: 'ai-1',
			dealerIndex: 1,
			gameSpecific: {
				phase: 'bidding',
				trumpSuit: 'hearts',
				bids: [],
				currentBidder: 0,
				cardsPerPlayer: 5
			}
		});
		expect(move).toBeNull();
	});

	it('ducks under a high card when AI bid is 0 to protect contract', () => {
		const move = computeOhWellAiMove({
			moves: [{ playerId: 'player-0', card: { suit: 'diamonds', rank: 13 }, timestamp: 1 }],
			seed,
			currentRound: 0,
			playerCount: 4,
			playerIds,
			aiPlayerId: 'ai-1',
			dealerIndex: 3,
			gameSpecific: {
				phase: 'playing',
				trumpSuit: 'clubs',
				bids: [
					{ playerId: 'player-0', bid: 1 },
					{ playerId: 'ai-1', bid: 0 },
					{ playerId: 'player-2', bid: 1 },
					{ playerId: 'player-3', bid: 1 }
				],
				currentBidder: 0,
				cardsPerPlayer: 5
			}
		});

		expect(move).not.toBeNull();
		expect(move!.card.suit).toBe('diamonds');
		expect(move!.card.rank).toBe(4);
	});

	it('captures trick with Ace when AI bid is 2 and needs tricks', () => {
		const move = computeOhWellAiMove({
			moves: [{ playerId: 'player-0', card: { suit: 'diamonds', rank: 13 }, timestamp: 1 }],
			seed,
			currentRound: 0,
			playerCount: 4,
			playerIds,
			aiPlayerId: 'ai-1',
			dealerIndex: 3,
			gameSpecific: {
				phase: 'playing',
				trumpSuit: 'clubs',
				bids: [
					{ playerId: 'player-0', bid: 1 },
					{ playerId: 'ai-1', bid: 2 },
					{ playerId: 'player-2', bid: 1 },
					{ playerId: 'player-3', bid: 1 }
				],
				currentBidder: 0,
				cardsPerPlayer: 5
			}
		});

		expect(move).not.toBeNull();
		expect(move!.card.suit).toBe('diamonds');
		expect(move!.card.rank).toBe(14);
	});
});
