import { describe, expect, it } from 'bun:test';
import { computeCanadianSaladAiMove } from '$lib/games/canadian-salad/ai.ts';
import { setupHand } from '$lib/games/canadian-salad/definition.ts';

describe('canadian salad ai simulation', () => {
	const playerIds = ['player-0', 'ai-1', 'player-2', 'player-3'];
	const seed = 12345;

	it('returns null when it is not the AI player turn', () => {
		const move = computeCanadianSaladAiMove({
			moves: [],
			seed,
			currentRound: 0,
			playerCount: 4,
			playerIds,
			aiPlayerId: 'ai-1',
			dealerIndex: 1
		});
		expect(move).toBeNull();
	});

	it('strictly follows led suit if the AI holds that suit', () => {
		const deal = setupHand(4, seed);
		const aiHand = deal.hands[1];
		const ledCard = deal.hands[0][0];

		const move = computeCanadianSaladAiMove({
			moves: [{ playerId: 'player-0', card: ledCard, timestamp: 1 }],
			seed,
			currentRound: 0,
			playerCount: 4,
			playerIds,
			aiPlayerId: 'ai-1',
			dealerIndex: 3
		});

		expect(move).not.toBeNull();
		const hasSuit = aiHand.some((c) => c.suit === ledCard.suit);
		if (hasSuit) {
			expect(move!.card.suit).toBe(ledCard.suit);
		}
	});

	it('avoids taking King of Spades in NO_KING_SPADES round', () => {
		const move = computeCanadianSaladAiMove({
			moves: [{ playerId: 'player-0', card: { suit: 'spades', rank: 10 }, timestamp: 1 }],
			seed,
			currentRound: 3,
			playerCount: 4,
			playerIds,
			aiPlayerId: 'ai-1',
			dealerIndex: 3
		});

		expect(move).not.toBeNull();
		expect(move!.card.suit).toBe('spades');
		expect(move!.card.rank).not.toBe(13);
	});
});
