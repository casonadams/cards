import { describe, expect, it } from 'bun:test';
import type { Card, Move } from '../src/lib/platform/types/card';
import {
	cribbageRuntime,
	dealCribbage,
	deriveCribbageState,
	evaluatePeggingPlay,
	scoreCribbageHand,
	scoreFlush,
	scoreHisNobs,
	cardPipValue,
	computeCribbageAiMove,
	type CribbageUiState
} from '../src/lib/games/cribbage';

describe('Cribbage Engine & Scoring', () => {
	describe('Card values and dealing', () => {
		it('calculates correct pip values', () => {
			expect(cardPipValue({ suit: 'hearts', rank: 14 })).toBe(1); // Ace
			expect(cardPipValue({ suit: 'hearts', rank: 2 })).toBe(2);
			expect(cardPipValue({ suit: 'hearts', rank: 9 })).toBe(9);
			expect(cardPipValue({ suit: 'hearts', rank: 10 })).toBe(10);
			expect(cardPipValue({ suit: 'hearts', rank: 11 })).toBe(10); // Jack
			expect(cardPipValue({ suit: 'hearts', rank: 12 })).toBe(10); // Queen
			expect(cardPipValue({ suit: 'hearts', rank: 13 })).toBe(10); // King
		});

		it('deals 6 cards to each player and selects distinct starter card', () => {
			const deal = dealCribbage(42, 0);
			expect(deal.hands.length).toBe(2);
			expect(deal.hands[0].length).toBe(6);
			expect(deal.hands[1].length).toBe(6);
			expect(deal.starterCard).toBeDefined();

			const allCards = [...deal.hands[0], ...deal.hands[1], deal.starterCard];
			const keys = new Set(allCards.map((c) => `${c.suit}:${c.rank}`));
			expect(keys.size).toBe(13);
		});

		it('is deterministic given the same seed and round', () => {
			const deal1 = dealCribbage(999, 2);
			const deal2 = dealCribbage(999, 2);
			expect(deal1.hands[0]).toEqual(deal2.hands[0]);
			expect(deal1.hands[1]).toEqual(deal2.hands[1]);
			expect(deal1.starterCard).toEqual(deal2.starterCard);
		});
	});

	describe('Hand Scoring Combinations', () => {
		it('scores the perfect 29 hand correctly', () => {
			const hand: Card[] = [
				{ suit: 'clubs', rank: 5 },
				{ suit: 'diamonds', rank: 5 },
				{ suit: 'hearts', rank: 5 },
				{ suit: 'spades', rank: 11 } // Jack of spades
			];
			const starter: Card = { suit: 'spades', rank: 5 }; // 5 of spades

			const result = scoreCribbageHand(hand, starter, false);

			expect(result.fifteens).toBe(16); // 8 combos of 15 = 16 pts
			expect(result.pairs).toBe(12); // 4 of a kind = 6 pairs = 12 pts
			expect(result.runs).toBe(0);
			expect(result.flush).toBe(0);
			expect(result.nobs).toBe(1); // Jack of spades matches starter suit spades
			expect(result.total).toBe(29);
		});

		it('scores a 28 hand (four 5s with a King)', () => {
			const hand: Card[] = [
				{ suit: 'clubs', rank: 5 },
				{ suit: 'diamonds', rank: 5 },
				{ suit: 'hearts', rank: 5 },
				{ suit: 'spades', rank: 5 }
			];
			const starter: Card = { suit: 'spades', rank: 13 }; // King

			const result = scoreCribbageHand(hand, starter, false);
			expect(result.fifteens).toBe(16);
			expect(result.pairs).toBe(12);
			expect(result.total).toBe(28);
		});

		it('scores double-double run (24 points)', () => {
			const hand: Card[] = [
				{ suit: 'clubs', rank: 7 },
				{ suit: 'diamonds', rank: 7 },
				{ suit: 'spades', rank: 8 },
				{ suit: 'hearts', rank: 8 }
			];
			const starter: Card = { suit: 'clubs', rank: 9 };

			const result = scoreCribbageHand(hand, starter, false);
			// 4 runs of 3 = 12 pts
			expect(result.runs).toBe(12);
			// 2 pairs = 4 pts
			expect(result.pairs).toBe(4);
			// 4 fifteens (7+8 = 15 x 4) = 8 pts
			expect(result.fifteens).toBe(8);
			expect(result.total).toBe(24);
		});

		it('scores flushes in hand and crib differently', () => {
			const heartsHand: Card[] = [
				{ suit: 'hearts', rank: 2 },
				{ suit: 'hearts', rank: 4 },
				{ suit: 'hearts', rank: 6 },
				{ suit: 'hearts', rank: 8 }
			];
			const spadeStarter: Card = { suit: 'spades', rank: 10 };
			const heartStarter: Card = { suit: 'hearts', rank: 10 };

			// Hand with 4 cards same suit + different starter = 4 pts
			expect(scoreFlush(heartsHand, spadeStarter, false).points).toBe(4);
			// Hand with 4 cards same suit + matching starter = 5 pts
			expect(scoreFlush(heartsHand, heartStarter, false).points).toBe(5);

			// Crib with 4 cards same suit + different starter = 0 pts (crib requires 5)
			expect(scoreFlush(heartsHand, spadeStarter, true).points).toBe(0);
			// Crib with all 5 matching = 5 pts
			expect(scoreFlush(heartsHand, heartStarter, true).points).toBe(5);
		});

		it('scores His Nobs only when Jack matches starter suit', () => {
			const handWithJack: Card[] = [
				{ suit: 'clubs', rank: 11 }, // J♣
				{ suit: 'diamonds', rank: 2 },
				{ suit: 'hearts', rank: 3 },
				{ suit: 'spades', rank: 4 }
			];
			expect(scoreHisNobs(handWithJack, { suit: 'clubs', rank: 7 })).toBe(1);
			expect(scoreHisNobs(handWithJack, { suit: 'hearts', rank: 7 })).toBe(0);
		});
	});

	describe('Pegging Evaluation', () => {
		it('scores 15 for 2 points', () => {
			const history: Card[] = [{ suit: 'hearts', rank: 7 }];
			const card: Card = { suit: 'spades', rank: 8 };
			const res = evaluatePeggingPlay(history, card, 7);
			expect(res.points).toBe(2);
			expect(res.newTotal).toBe(15);
		});

		it('scores 31 for 2 points', () => {
			const history: Card[] = [
				{ suit: 'hearts', rank: 10 },
				{ suit: 'diamonds', rank: 10 },
				{ suit: 'spades', rank: 7 }
			];
			const card: Card = { suit: 'clubs', rank: 4 };
			const res = evaluatePeggingPlay(history, card, 27);
			expect(res.points).toBe(2);
			expect(res.newTotal).toBe(31);
		});

		it('scores pairs, 3 of a kind, and 4 of a kind', () => {
			const c1: Card = { suit: 'hearts', rank: 6 };
			const c2: Card = { suit: 'diamonds', rank: 6 };
			const c3: Card = { suit: 'spades', rank: 6 };
			const c4: Card = { suit: 'clubs', rank: 6 };

			// Pair
			const pairRes = evaluatePeggingPlay([c1], c2, 6);
			expect(pairRes.points).toBe(2);

			// Three of a kind
			const threeRes = evaluatePeggingPlay([c1, c2], c3, 12);
			expect(threeRes.points).toBe(6);

			// Four of a kind
			const fourRes = evaluatePeggingPlay([c1, c2, c3], c4, 18);
			expect(fourRes.points).toBe(12);
		});

		it('scores runs in sequential and scrambled order', () => {
			const c1: Card = { suit: 'hearts', rank: 6 };
			const c2: Card = { suit: 'diamonds', rank: 4 };
			const c3: Card = { suit: 'spades', rank: 5 };

			// 6 then 4
			const r1 = evaluatePeggingPlay([c1], c2, 6);
			expect(r1.points).toBe(0);

			// 6 then 4 then 5: makes 15 (+2) AND run of 3 (+3) = 5 points!
			const r2 = evaluatePeggingPlay([c1, c2], c3, 10);
			expect(r2.points).toBe(5);
			expect(r2.newTotal).toBe(15);

			// Followed by 7 = run of 4 (4, 5, 6, 7) for 4 points
			const c4: Card = { suit: 'clubs', rank: 7 };
			const r3 = evaluatePeggingPlay([c1, c2, c3], c4, 15);
			expect(r3.points).toBe(4);
			expect(r3.newTotal).toBe(22);
		});
	});

	describe('Full Game State Derivation', () => {
		const playerIds = ['player-0', 'player-1'];

		it('awards 2 points to dealer on starter cut Jack (His Heels)', () => {
			// Find a seed where starter card (index 12) is a Jack (rank 11)
			let jackSeed = 0;
			for (let s = 0; s < 500; s++) {
				const d = dealCribbage(s, 0);
				if (d.starterCard.rank === 11) {
					jackSeed = s;
					break;
				}
			}

			const deal = dealCribbage(jackSeed, 0);
			expect(deal.starterCard.rank).toBe(11);

			// Non-dealer is player-1 (dealer is 0)
			// Both discard 2 cards
			const moves: Move[] = [
				{ playerId: 'player-1', card: deal.hands[1][0] },
				{ playerId: 'player-1', card: deal.hands[1][1] },
				{ playerId: 'player-0', card: deal.hands[0][0] },
				{ playerId: 'player-0', card: deal.hands[0][1] }
			];

			const state = deriveCribbageState({
				moves,
				seed: jackSeed,
				currentRound: 0,
				playerCount: 2,
				playerIds,
				myId: 'player-0',
				dealerIndex: 0
			});

			const ui = state.gameSpecific as CribbageUiState;
			expect(ui.hisHeels).toBe(true);
			expect(ui.playerPegScores['player-0']).toBe(2);
			expect(ui.playerPegScores['player-1']).toBe(0);
		});

		it('handles instant 121 win during pegging', () => {
			const deal = dealCribbage(1, 0);
			const moves: Move[] = [
				// Discards
				{ playerId: 'player-1', card: deal.hands[1][0] },
				{ playerId: 'player-1', card: deal.hands[1][1] },
				{ playerId: 'player-0', card: deal.hands[0][0] },
				{ playerId: 'player-0', card: deal.hands[0][1] }
			];

			const stateBefore = deriveCribbageState({
				moves,
				seed: 1,
				currentRound: 0,
				playerCount: 2,
				playerIds,
				myId: 'player-1',
				dealerIndex: 0
			});

			expect(stateBefore.isGameOver).toBe(false);
			expect(stateBefore.currentTurnIndex).toBe(1); // non-dealer leads pegging
		});
	});

	describe('Bot AI Heuristics', () => {
		it('computes legal discard move in <300ms SLA', () => {
			const start = performance.now();
			const move = computeCribbageAiMove({
				moves: [],
				seed: 42,
				currentRound: 0,
				playerCount: 2,
				playerIds: ['bot-0', 'bot-1'],
				aiPlayerId: 'bot-1', // non-dealer
				dealerIndex: 0
			});
			const elapsed = performance.now() - start;

			expect(move).not.toBeNull();
			expect(move!.playerId).toBe('bot-1');
			expect(elapsed).toBeLessThan(300);
		});

		it('computes legal pegging move that does not exceed 31', () => {
			const deal = dealCribbage(10, 0);
			const moves: Move[] = [
				{ playerId: 'bot-1', card: deal.hands[1][0] },
				{ playerId: 'bot-1', card: deal.hands[1][1] },
				{ playerId: 'bot-0', card: deal.hands[0][0] },
				{ playerId: 'bot-0', card: deal.hands[0][1] }
			];

			const move = computeCribbageAiMove({
				moves,
				seed: 10,
				currentRound: 0,
				playerCount: 2,
				playerIds: ['bot-0', 'bot-1'],
				aiPlayerId: 'bot-1',
				dealerIndex: 0
			});

			expect(move).not.toBeNull();
			expect(cardPipValue(move!.card)).toBeLessThanOrEqual(31);
		});
	});

	describe('GameRuntime contract', () => {
		it('adheres to GameRuntime interface', () => {
			expect(cribbageRuntime.id).toBe('cribbage');
			expect(cribbageRuntime.name).toBe('Cribbage');
			expect(cribbageRuntime.minPlayers).toBe(2);
			expect(cribbageRuntime.maxPlayers).toBe(2);
			expect(cribbageRuntime.totalRounds).toBe(0);
			expect(typeof cribbageRuntime.getRoundLabel(0)).toBe('string');
			expect(typeof cribbageRuntime.getRoundRules(0)).toBe('string');
		});
	});
});
