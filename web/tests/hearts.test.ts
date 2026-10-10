import { describe, it, expect } from 'bun:test';
import {
	dealHearts,
	isTwoOfClubs,
	isHeartsBroken,
	getPlayableHeartsCards,
	resolveHeartsTrick,
	calculateHeartsRoundScores,
	isHeartsGameOver,
	deriveHeartsState,
	computeHeartsAiMove,
	heartsRuntime
} from '../src/lib/games/hearts/index.ts';
import type { Card, Move, TrickPlay } from '$lib/platform/types/card';

describe('Hearts Game Engine', () => {
	it('exposes valid GameRuntime contract metadata', () => {
		expect(heartsRuntime.id).toBe('hearts');
		expect(heartsRuntime.name).toBe('Hearts');
		expect(heartsRuntime.minPlayers).toBe(3);
		expect(heartsRuntime.maxPlayers).toBe(4);
		expect(heartsRuntime.totalRounds).toBe(0);
		expect(heartsRuntime.getRoundLabel(0)).toBe('Round 1');
		expect(heartsRuntime.getRoundRules(0)).toContain('Hearts');
	});
	describe('1. Deal Determinism & Deck Configurations', () => {
		it('deals 52 cards evenly to 4 players with 0 removed cards', () => {
			const deal = dealHearts(4, 12345);
			expect(deal.hands.length).toBe(4);
			expect(deal.removedCards.length).toBe(0);
			for (const hand of deal.hands) {
				expect(hand.length).toBe(13);
			}

			// Ensure all 52 cards are unique
			const allCards = deal.hands.flat();
			const cardKeys = new Set(allCards.map((c) => `${c.suit}:${c.rank}`));
			expect(cardKeys.size).toBe(52);
		});

		it('produces identical hands with identical seeds', () => {
			const dealA = dealHearts(4, 42);
			const dealB = dealHearts(4, 42);
			expect(dealA.hands).toEqual(dealB.hands);
		});

		it('deals 51 cards to 3 players (17 each) with 2♦ removed', () => {
			const deal = dealHearts(3, 9999);
			expect(deal.hands.length).toBe(3);
			expect(deal.removedCards.length).toBe(1);
			expect(deal.removedCards[0]).toEqual({ suit: 'diamonds', rank: 2 });
			for (const hand of deal.hands) {
				expect(hand.length).toBe(17);
			}
			const allCards = deal.hands.flat();
			expect(allCards.some((c) => c.suit === 'diamonds' && c.rank === 2)).toBe(false);
		});
	});

	describe('2. Trick 1 Lead & Penalty Protection Rules', () => {
		it('mandates that the 2♣ lead must be played on trick 1 lead', () => {
			const hand: Card[] = [
				{ suit: 'clubs', rank: 2 },
				{ suit: 'clubs', rank: 5 },
				{ suit: 'diamonds', rank: 10 },
				{ suit: 'hearts', rank: 14 }
			];
			const playable = getPlayableHeartsCards({
				hand,
				moves: [],
				trickPlays: [],
				playerCount: 4
			});
			expect(playable).toEqual([{ suit: 'clubs', rank: 2 }]);
		});

		it('prohibits penalty cards on trick 1 when void in led suit if holding non-penalties', () => {
			// Led suit is clubs (trick 1)
			const trickPlays: TrickPlay[] = [
				{ playerId: 'p0', card: { suit: 'clubs', rank: 2 } }
			];
			const moves: Move[] = [
				{ playerId: 'p0', card: { suit: 'clubs', rank: 2 } }
			];
			const hand: Card[] = [
				{ suit: 'diamonds', rank: 4 }, // safe
				{ suit: 'hearts', rank: 10 },   // penalty!
				{ suit: 'spades', rank: 12 }    // Q♠ penalty!
			];

			const playable = getPlayableHeartsCards({
				hand,
				moves,
				trickPlays,
				playerCount: 4
			});

			// Only 4♦ is allowed; 10♥ and Q♠ are banned on trick 1
			expect(playable).toEqual([{ suit: 'diamonds', rank: 4 }]);
		});

		it('allows penalty cards on trick 1 if player holds ONLY penalty cards', () => {
			const trickPlays: TrickPlay[] = [
				{ playerId: 'p0', card: { suit: 'clubs', rank: 2 } }
			];
			const moves: Move[] = [
				{ playerId: 'p0', card: { suit: 'clubs', rank: 2 } }
			];
			const handOnlyPenalties: Card[] = [
				{ suit: 'hearts', rank: 5 },
				{ suit: 'hearts', rank: 14 },
				{ suit: 'spades', rank: 12 } // Q♠
			];

			const playable = getPlayableHeartsCards({
				hand: handOnlyPenalties,
				moves,
				trickPlays,
				playerCount: 4
			});

			// All are legal due to the exception
			expect(playable).toEqual(handOnlyPenalties);
		});
	});

	describe('3. Hearts Breaking Rule', () => {
		it('prevents leading hearts before hearts are broken', () => {
			const moves: Move[] = [
				// Trick 1 completed with no hearts
				{ playerId: 'p0', card: { suit: 'clubs', rank: 2 } },
				{ playerId: 'p1', card: { suit: 'clubs', rank: 5 } },
				{ playerId: 'p2', card: { suit: 'clubs', rank: 9 } },
				{ playerId: 'p3', card: { suit: 'clubs', rank: 10 } }
			];
			const hand: Card[] = [
				{ suit: 'hearts', rank: 10 },
				{ suit: 'diamonds', rank: 7 }
			];

			const playable = getPlayableHeartsCards({
				hand,
				moves,
				trickPlays: [],
				playerCount: 4
			});

			// Hearts not broken, must lead diamond
			expect(playable).toEqual([{ suit: 'diamonds', rank: 7 }]);
		});

		it('allows leading hearts if player has ONLY hearts remaining', () => {
			const moves: Move[] = [
				{ playerId: 'p0', card: { suit: 'clubs', rank: 2 } },
				{ playerId: 'p1', card: { suit: 'clubs', rank: 5 } },
				{ playerId: 'p2', card: { suit: 'clubs', rank: 9 } },
				{ playerId: 'p3', card: { suit: 'clubs', rank: 10 } }
			];
			const hand: Card[] = [
				{ suit: 'hearts', rank: 10 },
				{ suit: 'hearts', rank: 12 }
			];

			const playable = getPlayableHeartsCards({
				hand,
				moves,
				trickPlays: [],
				playerCount: 4
			});

			// Only hearts in hand -> permitted
			expect(playable).toEqual(hand);
		});

		it('confirms Queen of Spades discard does NOT break hearts', () => {
			const moves: Move[] = [
				{ playerId: 'p0', card: { suit: 'clubs', rank: 2 } },
				{ playerId: 'p1', card: { suit: 'clubs', rank: 5 } },
				{ playerId: 'p2', card: { suit: 'spades', rank: 12 } }, // Q♠ dumped
				{ playerId: 'p3', card: { suit: 'clubs', rank: 10 } }
			];
			expect(isHeartsBroken(moves)).toBe(false);
		});

		it('confirms playing a Heart breaks hearts', () => {
			const moves: Move[] = [
				{ playerId: 'p0', card: { suit: 'clubs', rank: 2 } },
				{ playerId: 'p1', card: { suit: 'hearts', rank: 4 } }, // heart dumped
				{ playerId: 'p2', card: { suit: 'clubs', rank: 9 } },
				{ playerId: 'p3', card: { suit: 'clubs', rank: 10 } }
			];
			expect(isHeartsBroken(moves)).toBe(true);
		});
	});

	describe('4. Trick Resolution & Scoring (Moon Shot & Game Over)', () => {
		it('resolves trick winner by highest card of led suit and accumulates points', () => {
			const plays: TrickPlay[] = [
				{ playerId: 'p0', card: { suit: 'diamonds', rank: 10 } },
				{ playerId: 'p1', card: { suit: 'diamonds', rank: 14 } }, // Ace wins
				{ playerId: 'p2', card: { suit: 'hearts', rank: 8 } },     // +1 pt
				{ playerId: 'p3', card: { suit: 'spades', rank: 12 } }     // Q♠ +13 pts
			];
			const res = resolveHeartsTrick(plays);
			expect(res.winnerId).toBe('p1');
			expect(res.points).toBe(14);
			expect(res.heartsCount).toBe(1);
			expect(res.hasQueenOfSpades).toBe(true);
		});

		it('handles standard round scoring', () => {
			const playerIds = ['p0', 'p1', 'p2', 'p3'];
			const moves: Move[] = [
				// Trick 1: p1 wins with 10♣, 0 pts
				{ playerId: 'p0', card: { suit: 'clubs', rank: 2 } },
				{ playerId: 'p1', card: { suit: 'clubs', rank: 10 } },
				{ playerId: 'p2', card: { suit: 'clubs', rank: 3 } },
				{ playerId: 'p3', card: { suit: 'clubs', rank: 4 } },
				// Trick 2: p0 wins with A♦, takes 5♥ (+1) and Q♠ (+13) = 14 pts
				{ playerId: 'p1', card: { suit: 'diamonds', rank: 9 } },
				{ playerId: 'p2', card: { suit: 'hearts', rank: 5 } },
				{ playerId: 'p3', card: { suit: 'spades', rank: 12 } },
				{ playerId: 'p0', card: { suit: 'diamonds', rank: 14 } }
			];

			const scores = calculateHeartsRoundScores(moves, 4, playerIds);
			expect(scores.pointsTaken['p0']).toBe(14);
			expect(scores.pointsTaken['p1']).toBe(0);
			expect(scores.shooterId).toBeNull();
		});

		it('detects Shooting the Moon and awards -26 points to shooter', () => {
			const playerIds = ['p0', 'p1', 'p2', 'p3'];
			// Construct a game where p0 wins all 26 points
			const moves: Move[] = [];
			// Trick 1: p0 wins with A♣ taking 4 hearts
			moves.push(
				{ playerId: 'p0', card: { suit: 'clubs', rank: 14 } },
				{ playerId: 'p1', card: { suit: 'hearts', rank: 2 } },
				{ playerId: 'p2', card: { suit: 'hearts', rank: 3 } },
				{ playerId: 'p3', card: { suit: 'hearts', rank: 4 } }
			);
			// Trick 2: p0 wins with A♦ taking 4 hearts
			moves.push(
				{ playerId: 'p0', card: { suit: 'diamonds', rank: 14 } },
				{ playerId: 'p1', card: { suit: 'hearts', rank: 5 } },
				{ playerId: 'p2', card: { suit: 'hearts', rank: 6 } },
				{ playerId: 'p3', card: { suit: 'hearts', rank: 7 } }
			);
			// Trick 3: p0 wins with K♦ taking 4 hearts
			moves.push(
				{ playerId: 'p0', card: { suit: 'diamonds', rank: 13 } },
				{ playerId: 'p1', card: { suit: 'hearts', rank: 8 } },
				{ playerId: 'p2', card: { suit: 'hearts', rank: 9 } },
				{ playerId: 'p3', card: { suit: 'hearts', rank: 10 } }
			);
			// Trick 4: p0 wins with Q♦ taking remaining hearts (J♥, Q♥, K♥, A♥)
			moves.push(
				{ playerId: 'p0', card: { suit: 'diamonds', rank: 12 } },
				{ playerId: 'p1', card: { suit: 'hearts', rank: 11 } },
				{ playerId: 'p2', card: { suit: 'hearts', rank: 12 } },
				{ playerId: 'p3', card: { suit: 'hearts', rank: 13 } }
			);
			// Trick 5: p0 wins taking A♥ and Q♠
			moves.push(
				{ playerId: 'p0', card: { suit: 'diamonds', rank: 11 } },
				{ playerId: 'p1', card: { suit: 'hearts', rank: 14 } },
				{ playerId: 'p2', card: { suit: 'spades', rank: 12 } }, // Q♠
				{ playerId: 'p3', card: { suit: 'diamonds', rank: 2 } }
			);

			const scores = calculateHeartsRoundScores(moves, 4, playerIds);
			expect(scores.shooterId).toBe('p0');
			expect(scores.pointsTaken['p0']).toBe(26);

			const p0Score = scores.roundScores.find((s) => s.playerId === 'p0');
			expect(p0Score?.points).toBe(-26);
			const p1Score = scores.roundScores.find((s) => s.playerId === 'p1');
			expect(p1Score?.points).toBe(0);
		});

		it('detects game over at 100 points threshold', () => {
			expect(isHeartsGameOver({ p0: 45, p1: 102, p2: 60, p3: 20 })).toBe(true);
			expect(isHeartsGameOver({ p0: 45, p1: 99, p2: 60, p3: 20 })).toBe(false);
		});
	});

	describe('5. Deterministic Bot AI & Simulation', () => {
		it('computes legal AI moves within SLA', () => {
			const playerIds = ['p0', 'p1', 'p2', 'p3'];
			const deal = dealHearts(4, 100);
			// Find who holds 2♣
			const holderIdx = deal.hands.findIndex((h) => h.some(isTwoOfClubs));
			const holderId = playerIds[holderIdx];

			const t0 = performance.now();
			const move = computeHeartsAiMove({
				moves: [],
				seed: 100,
				currentRound: 0,
				playerCount: 4,
				playerIds,
				aiPlayerId: holderId,
				dealerIndex: 0
			});
			const elapsed = performance.now() - t0;

			expect(elapsed).toBeLessThan(300);
			expect(move).not.toBeNull();
			expect(move?.card).toEqual({ suit: 'clubs', rank: 2 });
		});

		it('simulates a complete 4-player game round headlessly with zero errors', () => {
			const playerIds = ['p0', 'p1', 'p2', 'p3'];
			const seed = 54321;
			const moves: Move[] = [];

			for (let trick = 0; trick < 13; trick++) {
				for (let step = 0; step < 4; step++) {
					// Derive state for current player
					const state = deriveHeartsState({
						moves,
						seed,
						currentRound: 0,
						playerCount: 4,
						playerIds,
						myId: playerIds[0],
						dealerIndex: 0
					});

					const activeId = playerIds[state.currentTurnIndex];
					const move = computeHeartsAiMove({
						moves,
						seed,
						currentRound: 0,
						playerCount: 4,
						playerIds,
						aiPlayerId: activeId,
						dealerIndex: 0
					});

					expect(move).not.toBeNull();
					expect(move?.playerId).toBe(activeId);

					// Validate move is in playable cards for active player
					const activeState = deriveHeartsState({
						moves,
						seed,
						currentRound: 0,
						playerCount: 4,
						playerIds,
						myId: activeId,
						dealerIndex: 0
					});

					const isPlayable = activeState.playableCards.some(
						(c) => c.suit === move!.card.suit && c.rank === move!.card.rank
					);
					expect(isPlayable).toBe(true);

					moves.push({
						playerId: activeId,
						card: move!.card,
						timestamp: Date.now()
					});
				}
			}

			expect(moves.length).toBe(52);
			const finalState = deriveHeartsState({
				moves,
				seed,
				currentRound: 0,
				playerCount: 4,
				playerIds,
				myId: 'p0',
				dealerIndex: 0
			});

			expect(finalState.isRoundComplete).toBe(true);
			expect(finalState.roundScores).not.toBeNull();
			expect(finalState.roundScores?.length).toBe(4);
		});
	});
});
