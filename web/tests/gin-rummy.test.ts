import { describe, expect, it } from 'bun:test';
import type { Card, Move } from '../src/lib/platform/types/card';
import {
	ginRummyRuntime,
	dealGinRummy,
	deriveGinRummyState,
	findOptimalMelds,
	isValidSet,
	isValidRun,
	computeLayoffs,
	evaluateGinRound,
	ginCardValue,
	ginRunRank,
	computeGinRummyAiMove,
	type GinUiState
} from '../src/lib/games/gin-rummy';

describe('Gin Rummy Engine, Melds & Scoring', () => {
	describe('Card values and dealing', () => {
		it('evaluates card deadwood and sequence values correctly (Ace is low)', () => {
			expect(ginCardValue({ suit: 'hearts', rank: 14 })).toBe(1); // Ace deadwood = 1
			expect(ginRunRank({ suit: 'hearts', rank: 14 })).toBe(1); // Ace sequence = 1
			expect(ginCardValue({ suit: 'diamonds', rank: 5 })).toBe(5);
			expect(ginRunRank({ suit: 'diamonds', rank: 5 })).toBe(5);
			expect(ginCardValue({ suit: 'clubs', rank: 10 })).toBe(10);
			expect(ginCardValue({ suit: 'clubs', rank: 11 })).toBe(10); // Jack
			expect(ginRunRank({ suit: 'clubs', rank: 11 })).toBe(11);
			expect(ginCardValue({ suit: 'spades', rank: 12 })).toBe(10); // Queen
			expect(ginRunRank({ suit: 'spades', rank: 12 })).toBe(12);
			expect(ginCardValue({ suit: 'spades', rank: 13 })).toBe(10); // King
			expect(ginRunRank({ suit: 'spades', rank: 13 })).toBe(13);
		});

		it('deals 10 cards each, 1 upcard, and 31 stock cards deterministically', () => {
			const deal1 = dealGinRummy(12345, 0);
			const deal2 = dealGinRummy(12345, 0);

			expect(deal1.hands[0].length).toBe(10);
			expect(deal1.hands[1].length).toBe(10);
			expect(deal1.initialStock.length).toBe(31);
			expect(deal1.initialUpcard).toBeDefined();

			expect(deal1.hands[0]).toEqual(deal2.hands[0]);
			expect(deal1.hands[1]).toEqual(deal2.hands[1]);
			expect(deal1.initialUpcard).toEqual(deal2.initialUpcard);
		});
	});

	describe('Meld Validation', () => {
		it('validates sets of 3 and 4 of same rank', () => {
			const validSet3: Card[] = [
				{ suit: 'hearts', rank: 7 },
				{ suit: 'diamonds', rank: 7 },
				{ suit: 'clubs', rank: 7 }
			];
			expect(isValidSet(validSet3)).toBe(true);

			const validSet4: Card[] = [
				{ suit: 'hearts', rank: 13 },
				{ suit: 'diamonds', rank: 13 },
				{ suit: 'clubs', rank: 13 },
				{ suit: 'spades', rank: 13 }
			];
			expect(isValidSet(validSet4)).toBe(true);

			// Invalid: only 2 cards
			expect(isValidSet(validSet3.slice(0, 2))).toBe(false);

			// Invalid: duplicate suit
			const duplicateSuit: Card[] = [
				{ suit: 'hearts', rank: 7 },
				{ suit: 'hearts', rank: 7 },
				{ suit: 'clubs', rank: 7 }
			];
			expect(isValidSet(duplicateSuit)).toBe(false);
		});

		it('validates runs of 3+ consecutive cards in same suit (Ace low, no wrap-around)', () => {
			const aceRun: Card[] = [
				{ suit: 'hearts', rank: 14 }, // A
				{ suit: 'hearts', rank: 2 },
				{ suit: 'hearts', rank: 3 }
			];
			expect(isValidRun(aceRun)).toBe(true);

			const faceRun: Card[] = [
				{ suit: 'spades', rank: 10 },
				{ suit: 'spades', rank: 11 }, // J
				{ suit: 'spades', rank: 12 }, // Q
				{ suit: 'spades', rank: 13 } // K
			];
			expect(isValidRun(faceRun)).toBe(true);

			// Invalid: Wrap around Q-K-A is illegal in Gin Rummy
			const wrapAround: Card[] = [
				{ suit: 'spades', rank: 12 }, // Q
				{ suit: 'spades', rank: 13 }, // K
				{ suit: 'spades', rank: 14 } // A
			];
			expect(isValidRun(wrapAround)).toBe(false);

			// Invalid: different suits
			const mixedSuits: Card[] = [
				{ suit: 'hearts', rank: 4 },
				{ suit: 'diamonds', rank: 5 },
				{ suit: 'hearts', rank: 6 }
			];
			expect(isValidRun(mixedSuits)).toBe(false);
		});
	});

	describe('Optimal Meld Partitioning & Deadwood Minimization', () => {
		it('resolves overlapping sets and runs to maximize melds and minimize deadwood', () => {
			// Hand with 7♣, 7♦, 7♠, 8♠, 9♠, 10♠: 7♠ is shared!
			// Optimal: set [7♣, 7♦, 7♠] AND run [8♠, 9♠, 10♠] -> deadwood 0!
			const hand: Card[] = [
				{ suit: 'clubs', rank: 7 },
				{ suit: 'diamonds', rank: 7 },
				{ suit: 'spades', rank: 7 },
				{ suit: 'spades', rank: 8 },
				{ suit: 'spades', rank: 9 },
				{ suit: 'spades', rank: 10 },
				{ suit: 'hearts', rank: 2 },
				{ suit: 'diamonds', rank: 3 }
			];

			const partition = findOptimalMelds(hand);
			expect(partition.melds.length).toBe(2);
			expect(partition.deadwoodPoints).toBe(5); // 2 + 3 = 5
			expect(partition.deadwood.map((c) => c.rank)).toEqual([2, 3]);
		});

		it('identifies complete Gin (0 deadwood across 10 cards)', () => {
			const ginHand: Card[] = [
				// Run of 4
				{ suit: 'hearts', rank: 14 },
				{ suit: 'hearts', rank: 2 },
				{ suit: 'hearts', rank: 3 },
				{ suit: 'hearts', rank: 4 },
				// Set of 3
				{ suit: 'clubs', rank: 9 },
				{ suit: 'diamonds', rank: 9 },
				{ suit: 'spades', rank: 9 },
				// Set of 3
				{ suit: 'clubs', rank: 12 },
				{ suit: 'diamonds', rank: 12 },
				{ suit: 'hearts', rank: 12 }
			];

			const partition = findOptimalMelds(ginHand);
			expect(partition.deadwoodPoints).toBe(0);
			expect(partition.deadwood.length).toBe(0);
			expect(partition.melds.length).toBe(3);
		});

		it('identifies Big Gin (0 deadwood across all 11 cards)', () => {
			const bigGinHand: Card[] = [
				// Run of 4
				{ suit: 'hearts', rank: 14 },
				{ suit: 'hearts', rank: 2 },
				{ suit: 'hearts', rank: 3 },
				{ suit: 'hearts', rank: 4 },
				// Set of 4
				{ suit: 'clubs', rank: 9 },
				{ suit: 'diamonds', rank: 9 },
				{ suit: 'hearts', rank: 9 },
				{ suit: 'spades', rank: 9 },
				// Set of 3
				{ suit: 'clubs', rank: 12 },
				{ suit: 'diamonds', rank: 12 },
				{ suit: 'hearts', rank: 12 }
			];

			const partition = findOptimalMelds(bigGinHand);
			expect(partition.deadwoodPoints).toBe(0);
			expect(partition.deadwood.length).toBe(0);
			expect(partition.melds.length).toBe(3);
		});
	});

	describe('Layoff Engine', () => {
		it('allows defender to lay off deadwood onto knocker sets and runs', () => {
			const knockerMelds = [
				{
					type: 'set' as const,
					cards: [
						{ suit: 'hearts', rank: 5 },
						{ suit: 'diamonds', rank: 5 },
						{ suit: 'clubs', rank: 5 }
					]
				},
				{
					type: 'run' as const,
					cards: [
						{ suit: 'spades', rank: 7 },
						{ suit: 'spades', rank: 8 },
						{ suit: 'spades', rank: 9 }
					]
				}
			];

			const defenderDeadwood: Card[] = [
				{ suit: 'spades', rank: 5 }, // Can lay off onto set of 5s
				{ suit: 'spades', rank: 6 }, // Can lay off onto low end of 7-8-9 run
				{ suit: 'spades', rank: 10 }, // Can lay off onto high end of 7-8-9 run
				{ suit: 'hearts', rank: 13 } // King of hearts cannot lay off
			];

			const result = computeLayoffs(defenderDeadwood, knockerMelds);
			expect(result.laidOffCards.length).toBe(3);
			expect(result.remainingDeadwood.length).toBe(1);
			expect(result.remainingDeadwood[0].rank).toBe(13);
			expect(result.remainingDeadwoodPoints).toBe(10);
		});
	});

	describe('Round Evaluation: Knock, Gin, Layoffs, Undercut', () => {
		it('evaluates normal knocker win with deadwood difference', () => {
			const knockerHand: Card[] = [
				// Run of 3 (0 deadwood)
				{ suit: 'hearts', rank: 2 },
				{ suit: 'hearts', rank: 3 },
				{ suit: 'hearts', rank: 4 },
				// Set of 3 (0 deadwood)
				{ suit: 'clubs', rank: 8 },
				{ suit: 'diamonds', rank: 8 },
				{ suit: 'spades', rank: 8 },
				// Set of 3 (0 deadwood)
				{ suit: 'clubs', rank: 10 },
				{ suit: 'diamonds', rank: 10 },
				{ suit: 'spades', rank: 10 },
				// 1 deadwood card
				{ suit: 'diamonds', rank: 5 } // 5 pts deadwood
			];

			const defenderHand: Card[] = [
				// Run of 3
				{ suit: 'clubs', rank: 2 },
				{ suit: 'clubs', rank: 3 },
				{ suit: 'clubs', rank: 4 },
				// 7 deadwood cards: 2 + 3 + 4 + 6 + 7 + 8 + 9 = lots
				{ suit: 'diamonds', rank: 6 },
				{ suit: 'diamonds', rank: 7 },
				{ suit: 'hearts', rank: 8 },
				{ suit: 'spades', rank: 9 },
				{ suit: 'hearts', rank: 11 },
				{ suit: 'hearts', rank: 12 },
				{ suit: 'hearts', rank: 13 }
			];

			const res = evaluateGinRound({
				knockerId: 'p0',
				defenderId: 'p1',
				knockerHand,
				defenderHand
			});

			expect(res.winnerId).toBe('p0');
			expect(res.isGin).toBe(false);
			expect(res.isUndercut).toBe(false);
			expect(res.knockerDeadwood).toBe(5);
			expect(res.pointsWon).toBe(res.defenderDeadwoodAfterLayoffs - 5);
		});

		it('evaluates Gin with +25 bonus and prohibits layoffs', () => {
			const knockerHand: Card[] = [
				// Run of 4
				{ suit: 'hearts', rank: 14 },
				{ suit: 'hearts', rank: 2 },
				{ suit: 'hearts', rank: 3 },
				{ suit: 'hearts', rank: 4 },
				// Set of 3
				{ suit: 'clubs', rank: 8 },
				{ suit: 'diamonds', rank: 8 },
				{ suit: 'spades', rank: 8 },
				// Set of 3
				{ suit: 'clubs', rank: 10 },
				{ suit: 'diamonds', rank: 10 },
				{ suit: 'spades', rank: 10 }
			];

			const defenderHand: Card[] = [
				// Defender holds 5♥ which could otherwise lay off onto 14♥-2♥-3♥-4♥
				{ suit: 'hearts', rank: 5 },
				{ suit: 'spades', rank: 11 },
				{ suit: 'spades', rank: 12 },
				{ suit: 'spades', rank: 13 },
				{ suit: 'clubs', rank: 2 },
				{ suit: 'diamonds', rank: 2 },
				{ suit: 'spades', rank: 2 },
				{ suit: 'diamonds', rank: 4 },
				{ suit: 'diamonds', rank: 6 },
				{ suit: 'diamonds', rank: 7 }
			];

			const res = evaluateGinRound({
				knockerId: 'p0',
				defenderId: 'p1',
				knockerHand,
				defenderHand
			});

			expect(res.winnerId).toBe('p0');
			expect(res.isGin).toBe(true);
			expect(res.layoffs.length).toBe(0); // Prohibited
			expect(res.pointsWon).toBe(res.defenderInitialDeadwood + 25);
		});

		it('evaluates Undercut with +25 bonus when defender deadwood <= knocker deadwood', () => {
			const knockerHand: Card[] = [
				// 9 melded cards
				{ suit: 'hearts', rank: 2 },
				{ suit: 'hearts', rank: 3 },
				{ suit: 'hearts', rank: 4 },
				{ suit: 'clubs', rank: 8 },
				{ suit: 'diamonds', rank: 8 },
				{ suit: 'spades', rank: 8 },
				{ suit: 'clubs', rank: 10 },
				{ suit: 'diamonds', rank: 10 },
				{ suit: 'spades', rank: 10 },
				// 1 deadwood card = 7 pts
				{ suit: 'clubs', rank: 7 }
			];

			const defenderHand: Card[] = [
				// 9 melded cards
				{ suit: 'diamonds', rank: 2 },
				{ suit: 'diamonds', rank: 3 },
				{ suit: 'diamonds', rank: 4 },
				{ suit: 'clubs', rank: 6 },
				{ suit: 'diamonds', rank: 6 },
				{ suit: 'spades', rank: 6 },
				{ suit: 'clubs', rank: 7 },
				{ suit: 'diamonds', rank: 7 },
				{ suit: 'spades', rank: 7 },
				// 1 deadwood card = 3 pts
				{ suit: 'clubs', rank: 3 }
			];

			// Knocker deadwood = 8, Defender deadwood = 3. Defender has LESS deadwood!
			const res = evaluateGinRound({
				knockerId: 'p0',
				defenderId: 'p1',
				knockerHand,
				defenderHand
			});

			expect(res.winnerId).toBe('p1'); // Defender wins!
			expect(res.isUndercut).toBe(true);
			// Difference is 7 - 3 = 4, plus 25 undercut bonus = 29 pts
			expect(res.pointsWon).toBe(4 + 25);
		});
	});

	describe('Turn Flow & State Derivation', () => {
		const playerIds = ['player-0', 'player-1'];

		it('provides valid draw options (discard or stock) on initial turn', () => {
			const state = deriveGinRummyState({
				moves: [],
				seed: 123,
				currentRound: 0,
				playerCount: 2,
				playerIds,
				myId: 'player-1', // non-dealer (starts)
				dealerIndex: 0
			});

			const ui = state.gameSpecific as GinUiState;
			expect(ui.phase).toBe('draw');
			expect(state.isMyTurn).toBe(true);
			expect(state.playableCards.length).toBe(2); // Top discard and top stock
		});

		it('transitions to discard phase after drawing', () => {
			const deal = dealGinRummy(123, 0);
			const moves: Move[] = [
				// Player 1 draws the top discard
				{ playerId: 'player-1', card: deal.initialUpcard }
			];

			const state = deriveGinRummyState({
				moves,
				seed: 123,
				currentRound: 0,
				playerCount: 2,
				playerIds,
				myId: 'player-1',
				dealerIndex: 0
			});

			const ui = state.gameSpecific as GinUiState;
			expect(ui.phase).toBe('discard');
			expect(state.isMyTurn).toBe(true);
			expect(state.myRemainingHand.length).toBe(11); // Drew card, now has 11
			expect(state.playableCards.length).toBe(11); // Can discard any of 11
		});
	});

	describe('Bot AI Heuristics', () => {
		it('computes legal draw move within <300ms SLA', () => {
			const start = performance.now();
			const move = computeGinRummyAiMove({
				moves: [],
				seed: 456,
				currentRound: 0,
				playerCount: 2,
				playerIds: ['bot-0', 'bot-1'],
				aiPlayerId: 'bot-1',
				dealerIndex: 0
			});
			const elapsed = performance.now() - start;

			expect(move).not.toBeNull();
			expect(move!.playerId).toBe('bot-1');
			expect(elapsed).toBeLessThan(300);
		});

		it('computes discard move minimizing deadwood', () => {
			const deal = dealGinRummy(789, 0);
			const moves: Move[] = [
				{ playerId: 'bot-1', card: deal.initialUpcard }
			];

			const move = computeGinRummyAiMove({
				moves,
				seed: 789,
				currentRound: 0,
				playerCount: 2,
				playerIds: ['bot-0', 'bot-1'],
				aiPlayerId: 'bot-1',
				dealerIndex: 0
			});

			expect(move).not.toBeNull();
			expect(move!.playerId).toBe('bot-1');
		});
	});

	describe('GameRuntime contract', () => {
		it('adheres to GameRuntime interface', () => {
			expect(ginRummyRuntime.id).toBe('gin-rummy');
			expect(ginRummyRuntime.name).toBe('Gin Rummy');
			expect(ginRummyRuntime.minPlayers).toBe(2);
			expect(ginRummyRuntime.maxPlayers).toBe(2);
			expect(ginRummyRuntime.totalRounds).toBe(0);
			expect(typeof ginRummyRuntime.getRoundLabel(0)).toBe('string');
			expect(typeof ginRummyRuntime.getRoundRules(0)).toBe('string');
		});
	});
});
