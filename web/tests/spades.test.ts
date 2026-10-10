import { describe, it, expect } from 'bun:test';
import {
	spadesRuntime,
	dealSpades,
	isSpadesBroken,
	getPlayableSpadesCards,
	resolveSpadesTrick,
	calculateSpadesRoundScores,
	evaluateSpadesHand,
	computeSpadesAiMove,
	deriveSpadesState,
	createInitialSpadesState,
	applySpadesBid,
	computeSpadesAiBid
} from '../src/lib/games/spades/index.ts';
import {
	initSpadesGameSpecific,
	computeSpadesAiBidForDoc,
	getCurrentSpadesBidderId,
	isSpadesBiddingPhase
} from '../src/lib/room/spades-helpers.ts';
import type { Card, Move, TrickPlay } from '$lib/platform/types/card';
import type { SpadesPlayerBid, SpadesRoundState } from '../src/lib/games/spades/types.ts';
import type { GameDocument } from '$lib/platform/engine/index';

describe('Spades Game Engine', () => {
	it('exposes valid GameRuntime contract metadata', () => {
		expect(spadesRuntime.id).toBe('spades');
		expect(spadesRuntime.name).toBe('Spades');
		expect(spadesRuntime.minPlayers).toBe(4);
		expect(spadesRuntime.maxPlayers).toBe(6);
		expect(spadesRuntime.totalRounds).toBe(0);
		expect(spadesRuntime.getRoundLabel(0)).toBe('Round 1');
		expect(spadesRuntime.getRoundRules(0)).toContain('Spades');
	});

	describe('1. Deal Determinism & Deck Scaling', () => {
		it('deals 4 players 13 cards each from 52-card deck', () => {
			const deal = dealSpades(4, 1111);
			expect(deal.hands.length).toBe(4);
			expect(deal.removedCards.length).toBe(0);
			for (const h of deal.hands) {
				expect(h.length).toBe(13);
			}
			const all = deal.hands.flat();
			expect(new Set(all.map((c) => `${c.suit}:${c.rank}`)).size).toBe(52);
		});

		it('deals 6 players 17 cards each from 104-card double deck (2 cards burned)', () => {
			const deal = dealSpades(6, 2222);
			expect(deal.hands.length).toBe(6);
			expect(deal.removedCards.length).toBe(2);
			for (const h of deal.hands) {
				expect(h.length).toBe(17);
			}
			const totalDealt = deal.hands.flat().length + deal.removedCards.length;
			expect(totalDealt).toBe(104);
		});
	});

	describe('2. Spades Trump & Breaking Rules', () => {
		it('prevents leading Spades until broken', () => {
			const hand: Card[] = [
				{ suit: 'spades', rank: 14 },
				{ suit: 'hearts', rank: 10 },
				{ suit: 'diamonds', rank: 5 }
			];
			const playable = getPlayableSpadesCards({
				hand,
				moves: [],
				trickPlays: [],
				playerCount: 4
			});
			// Cannot lead spades
			expect(playable).toEqual([
				{ suit: 'hearts', rank: 10 },
				{ suit: 'diamonds', rank: 5 }
			]);
		});

		it('allows leading Spades if player holds ONLY spades', () => {
			const hand: Card[] = [
				{ suit: 'spades', rank: 14 },
				{ suit: 'spades', rank: 10 }
			];
			const playable = getPlayableSpadesCards({
				hand,
				moves: [],
				trickPlays: [],
				playerCount: 4
			});
			expect(playable).toEqual(hand);
		});

		it('detects when Spades are broken by a trump or discard', () => {
			// Trick 1: Clubs led, p2 plays Spades
			const moves: Move[] = [
				{ playerId: 'p0', card: { suit: 'clubs', rank: 10 } },
				{ playerId: 'p1', card: { suit: 'clubs', rank: 12 } },
				{ playerId: 'p2', card: { suit: 'spades', rank: 3 } }, // broke spades!
				{ playerId: 'p3', card: { suit: 'clubs', rank: 14 } }
			];
			expect(isSpadesBroken(moves, 4)).toBe(true);
		});
	});

	describe('3. Trick Resolution & 6p Double-Deck Duplicate Ties', () => {
		it('resolves normal trick where Spades trump led suit', () => {
			const plays: TrickPlay[] = [
				{ playerId: 'p0', card: { suit: 'hearts', rank: 14 } }, // Ace hearts
				{ playerId: 'p1', card: { suit: 'hearts', rank: 9 } },
				{ playerId: 'p2', card: { suit: 'spades', rank: 2 } },  // trump 2♠
				{ playerId: 'p3', card: { suit: 'hearts', rank: 13 } }
			];
			const res = resolveSpadesTrick(plays);
			expect(res.winnerId).toBe('p2');
			expect(res.winningCard).toEqual({ suit: 'spades', rank: 2 });
		});

		it('awards duplicate card ties to the SECOND duplicate card played', () => {
			// In 6p double deck: P0 plays A♠, P2 plays K♠, P4 plays A♠
			const plays: TrickPlay[] = [
				{ playerId: 'p0', card: { suit: 'spades', rank: 14 } }, // 1st A♠
				{ playerId: 'p1', card: { suit: 'hearts', rank: 10 } },
				{ playerId: 'p2', card: { suit: 'spades', rank: 13 } },
				{ playerId: 'p3', card: { suit: 'diamonds', rank: 8 } },
				{ playerId: 'p4', card: { suit: 'spades', rank: 14 } }, // 2nd A♠ -> WINS!
				{ playerId: 'p5', card: { suit: 'clubs', rank: 2 } }
			];
			const res = resolveSpadesTrick(plays);
			expect(res.winnerId).toBe('p4');
			expect(res.winningCard).toEqual({ suit: 'spades', rank: 14 });
		});

		it('awards duplicate card ties on non-spade led suit to SECOND duplicate card played', () => {
			const plays: TrickPlay[] = [
				{ playerId: 'p0', card: { suit: 'diamonds', rank: 14 } }, // 1st A♦
				{ playerId: 'p1', card: { suit: 'diamonds', rank: 9 } },
				{ playerId: 'p2', card: { suit: 'diamonds', rank: 14 } }, // 2nd A♦ -> WINS!
				{ playerId: 'p3', card: { suit: 'diamonds', rank: 4 } }
			];
			const res = resolveSpadesTrick(plays);
			expect(res.winnerId).toBe('p2');
		});
	});

	describe('4. Bidding & 10-Bag Penalty Math', () => {
		const playerIds = ['p0', 'p1', 'p2', 'p3'];

		it('scores regular team contract and overtrick bags correctly', () => {
			// Team 1: p0 (bid 3) + p2 (bid 4) = contract 7
			// Team 2: p1 (bid 2) + p3 (bid 3) = contract 5
			const bids: SpadesPlayerBid[] = [
				{ playerId: 'p0', bidType: 'regular', amount: 3 },
				{ playerId: 'p1', bidType: 'regular', amount: 2 },
				{ playerId: 'p2', bidType: 'regular', amount: 4 },
				{ playerId: 'p3', bidType: 'regular', amount: 3 }
			];
			// Team 1 takes 8 tricks (7 contract + 1 bag)
			// Team 2 takes 5 tricks (exact)
			const tricksTaken = { p0: 4, p1: 2, p2: 4, p3: 3 };

			const res = calculateSpadesRoundScores({
				playerIds,
				bids,
				tricksTaken,
				mode: '4p_teams',
				previousBags: { team1: 2, team2: 0 }
			});

			// Team 1: 7 * 10 + 1 = 71 points; bags become 2 + 1 = 3
			expect(res.teamPoints['team1']).toBe(71);
			expect(res.newBags['team1']).toBe(3);

			// Team 2: 5 * 10 = 50 points; 0 bags
			expect(res.teamPoints['team2']).toBe(50);
			expect(res.newBags['team2']).toBe(0);
		});

		it('penalizes set team contract with -10 * bid and 0 bags', () => {
			const bids: SpadesPlayerBid[] = [
				{ playerId: 'p0', bidType: 'regular', amount: 4 },
				{ playerId: 'p1', bidType: 'regular', amount: 3 },
				{ playerId: 'p2', bidType: 'regular', amount: 4 }, // Team 1 contract = 8
				{ playerId: 'p3', bidType: 'regular', amount: 2 }
			];
			// Team 1 takes only 6 tricks (failed!)
			const tricksTaken = { p0: 3, p1: 4, p2: 3, p3: 3 };

			const res = calculateSpadesRoundScores({
				playerIds,
				bids,
				tricksTaken,
				mode: '4p_teams',
				previousBags: { team1: 4 }
			});

			expect(res.teamPoints['team1']).toBe(-80);
			expect(res.newBags['team1']).toBe(4); // bags unchanged
		});

		it('handles successful and failed Nil bids and converts failed nil tricks to bags', () => {
			const bids: SpadesPlayerBid[] = [
				{ playerId: 'p0', bidType: 'nil', amount: 0 },
				{ playerId: 'p1', bidType: 'regular', amount: 3 },
				{ playerId: 'p2', bidType: 'regular', amount: 4 }, // Team 1 contract = 4 (p2 only)
				{ playerId: 'p3', bidType: 'regular', amount: 3 }
			];
			// Case A: p0 successfully makes Nil (0 tricks), p2 makes 4 tricks
			const resSuccess = calculateSpadesRoundScores({
				playerIds,
				bids,
				tricksTaken: { p0: 0, p1: 5, p2: 4, p3: 4 },
				mode: '4p_teams'
			});
			// Team 1: 4*10 (40) + 100 (nil bonus) = 140
			expect(resSuccess.teamPoints['team1']).toBe(140);
			expect(resSuccess.newBags['team1']).toBe(0);

			// Case B: p0 fails Nil (takes 1 trick), p2 takes 4 tricks
			const resFail = calculateSpadesRoundScores({
				playerIds,
				bids,
				tricksTaken: { p0: 1, p1: 4, p2: 4, p3: 4 },
				mode: '4p_teams',
				previousBags: { team1: 0 }
			});
			// Team 1: 4*10 (40) - 100 (nil penalty) = -60
			// And the 1 trick taken by p0 becomes a bag!
			expect(resFail.teamPoints['team1']).toBe(-60);
			expect(resFail.newBags['team1']).toBe(1);
		});

		it('triggers 10-bag penalty (-100 points) and resets bags modulo 10', () => {
			const bids: SpadesPlayerBid[] = [
				{ playerId: 'p0', bidType: 'regular', amount: 3 },
				{ playerId: 'p1', bidType: 'regular', amount: 2 },
				{ playerId: 'p2', bidType: 'regular', amount: 3 }, // contract = 6
				{ playerId: 'p3', bidType: 'regular', amount: 2 }
			];
			// Team 1 has 9 bags previously.
			// This round, Team 1 takes 8 tricks (2 bags!). Total bags = 11.
			const res = calculateSpadesRoundScores({
				playerIds,
				bids,
				tricksTaken: { p0: 4, p1: 2, p2: 4, p3: 3 },
				mode: '4p_teams',
				previousBags: { team1: 9 }
			});

			// Base: 60 + 2 bags = 62.
			// 10-bag penalty: -100 points! Net = 62 - 100 = -38 points.
			// Bags rollover: 11 - 10 = 1 bag remaining.
			expect(res.teamPoints['team1']).toBe(-38);
			expect(res.newBags['team1']).toBe(1);
		});
	});

	describe('5. Partnership Coordination & Bot AI', () => {
		it('evaluates hand strength for bidding', () => {
			const strongHand: Card[] = [
				{ suit: 'spades', rank: 14 },
				{ suit: 'spades', rank: 13 },
				{ suit: 'spades', rank: 12 },
				{ suit: 'spades', rank: 11 },
				{ suit: 'hearts', rank: 14 }
			];
			const evalStrong = evaluateSpadesHand(strongHand);
			expect(evalStrong.recommendedBid).toBeGreaterThanOrEqual(3);
			expect(evalStrong.canNil).toBe(false);

			const nilHand: Card[] = [
				{ suit: 'spades', rank: 2 },
				{ suit: 'hearts', rank: 3 },
				{ suit: 'diamonds', rank: 4 },
				{ suit: 'clubs', rank: 5 }
			];
			const evalNil = evaluateSpadesHand(nilHand);
			expect(evalNil.canNil).toBe(true);
		});

		it('ducks when partner holds the winning card on table', () => {
			const playerIds = ['p0', 'p1', 'p2', 'p3'];
			// p0 (partner of p2) led A♦. p1 played 10♦.
			// Now it is p2's turn. p0 is currently winning.
			const moves: Move[] = [
				{ playerId: 'p0', card: { suit: 'diamonds', rank: 14 } },
				{ playerId: 'p1', card: { suit: 'diamonds', rank: 10 } }
			];

			// Call computeSpadesAiMove for p2
			const move = computeSpadesAiMove({
				moves,
				seed: 1234,
				currentRound: 0,
				playerCount: 4,
				playerIds,
				aiPlayerId: 'p2',
				dealerIndex: 3,
				gameSpecific: {
					mode: '4p_teams',
					phase: 'playing',
					bids: [
						{ playerId: 'p0', bidType: 'regular', amount: 3 },
						{ playerId: 'p1', bidType: 'regular', amount: 3 },
						{ playerId: 'p2', bidType: 'regular', amount: 3 },
						{ playerId: 'p3', bidType: 'regular', amount: 3 }
					]
				}
			});

			expect(move).not.toBeNull();
			// Partner has winning card, AI should have selected a card
			expect(move?.playerId).toBe('p2');
		});

		it('runs a complete 4-player Spades match headlessly to round completion', () => {
			const playerIds = ['p0', 'p1', 'p2', 'p3'];
			const seed = 8888;
			const moves: Move[] = [];

			for (let trick = 0; trick < 13; trick++) {
				for (let step = 0; step < 4; step++) {
					const state = deriveSpadesState({
						moves,
						seed,
						currentRound: 0,
						playerCount: 4,
						playerIds,
						myId: 'p0',
						dealerIndex: 0
					});

					const activeId = playerIds[state.currentTurnIndex];
					const move = computeSpadesAiMove({
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

					moves.push({
						playerId: activeId,
						card: move!.card,
						timestamp: Date.now()
					});
				}
			}

			expect(moves.length).toBe(52);
			const finalState = deriveSpadesState({
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
		});

		it('runs a complete 6-player 104-card double deck Spades match headlessly', () => {
			const playerIds = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'];
			const seed = 9999;
			const moves: Move[] = [];

			for (let trick = 0; trick < 17; trick++) {
				for (let step = 0; step < 6; step++) {
					const state = deriveSpadesState({
						moves,
						seed,
						currentRound: 0,
						playerCount: 6,
						playerIds,
						myId: 'p0',
						dealerIndex: 0
					});

					const activeId = playerIds[state.currentTurnIndex];
					const move = computeSpadesAiMove({
						moves,
						seed,
						currentRound: 0,
						playerCount: 6,
						playerIds,
						aiPlayerId: activeId,
						dealerIndex: 0
					});

					expect(move).not.toBeNull();
					expect(move?.playerId).toBe(activeId);

					moves.push({
						playerId: activeId,
						card: move!.card,
						timestamp: Date.now()
					});
				}
			}

			expect(moves.length).toBe(102);
			const finalState = deriveSpadesState({
				moves,
				seed,
				currentRound: 0,
				playerCount: 6,
				playerIds,
				myId: 'p0',
				dealerIndex: 0
			});

			expect(finalState.isRoundComplete).toBe(true);
		});
	});

	describe('6. Bidding Lifecycle & State Transitions', () => {
		const playerIds = ['p0', 'p1', 'p2', 'p3'];

		it('initializes round in bidding phase starting left of dealer', () => {
			const initial = createInitialSpadesState({
				playerIds,
				dealerIndex: 0
			});

			expect(initial.phase).toBe('bidding');
			expect(initial.bids).toEqual([]);
			expect(initial.currentBidder).toBe(1); // p1 bids first
			expect(initial.spadesBroken).toBe(false);

			const viaHelper = initSpadesGameSpecific({ playerIds, dealerIndex: 0 });
			expect(viaHelper.phase).toBe('bidding');
			expect(viaHelper.currentBidder).toBe(1);
		});

		it('progressively records bids and transitions to playing phase once all players bid', () => {
			let doc: GameDocument = {
				roomId: 'test-room',
				phase: 'playing',
				currentRound: 0,
				seed: 42,
				dealerIndex: 0,
				moves: [],
				playerIds,
				roundScores: [],
				gameSpecific: createInitialSpadesState({ playerIds, dealerIndex: 0 }),
				lastUpdate: Date.now()
			};

			expect(getCurrentSpadesBidderId(doc)).toBe('p1');

			// p1 bids 3
			doc = applySpadesBid({
				doc,
				bid: { playerId: 'p1', bidType: 'regular', amount: 3 }
			});
			let rs = doc.gameSpecific as SpadesRoundState;
			expect(rs.phase).toBe('bidding');
			expect(rs.bids.length).toBe(1);
			expect(rs.currentBidder).toBe(2);
			expect(getCurrentSpadesBidderId(doc)).toBe('p2');

			// p2 bids Nil
			doc = applySpadesBid({
				doc,
				bid: { playerId: 'p2', bidType: 'nil', amount: 0 }
			});
			rs = doc.gameSpecific as SpadesRoundState;
			expect(rs.phase).toBe('bidding');
			expect(rs.bids.length).toBe(2);
			expect(rs.currentBidder).toBe(3);
			expect(getCurrentSpadesBidderId(doc)).toBe('p3');

			// p3 bids 4
			doc = applySpadesBid({
				doc,
				bid: { playerId: 'p3', bidType: 'regular', amount: 4 }
			});
			rs = doc.gameSpecific as SpadesRoundState;
			expect(rs.phase).toBe('bidding');
			expect(rs.bids.length).toBe(3);
			expect(rs.currentBidder).toBe(0);
			expect(getCurrentSpadesBidderId(doc)).toBe('p0');

			// p0 (dealer) bids 2 -> all 4 bids are in!
			doc = applySpadesBid({
				doc,
				bid: { playerId: 'p0', bidType: 'regular', amount: 2 }
			});
			rs = doc.gameSpecific as SpadesRoundState;
			expect(rs.phase).toBe('playing');
			expect(rs.bids.length).toBe(4);
			expect(rs.currentBidder).toBe(-1);
			expect(getCurrentSpadesBidderId(doc)).toBeUndefined();
		});

		it('enforces bidding turn in deriveSpadesState and blocks playable cards during bidding', () => {
			const roundState = createInitialSpadesState({ playerIds, dealerIndex: 0 });

			// For p0 (dealer): not their turn yet (p1 is first)
			const stateP0 = deriveSpadesState({
				moves: [],
				seed: 42,
				currentRound: 0,
				playerCount: 4,
				playerIds,
				myId: 'p0',
				dealerIndex: 0,
				gameSpecific: roundState
			});

			expect(isSpadesBiddingPhase(stateP0)).toBe(true);
			expect(stateP0.currentTurnIndex).toBe(1);
			expect(stateP0.isMyTurn).toBe(false);
			expect(stateP0.playableCards).toEqual([]);

			// For p1 (first bidder): it is their turn to bid, but playable cards must be empty!
			const stateP1 = deriveSpadesState({
				moves: [],
				seed: 42,
				currentRound: 0,
				playerCount: 4,
				playerIds,
				myId: 'p1',
				dealerIndex: 0,
				gameSpecific: roundState
			});

			expect(isSpadesBiddingPhase(stateP1)).toBe(true);
			expect(stateP1.currentTurnIndex).toBe(1);
			expect(stateP1.isMyTurn).toBe(true);
			expect(stateP1.playableCards).toEqual([]); // cards cannot be played during bidding!
		});

		it('computes valid AI bid from deal hand for doc', () => {
			const doc: GameDocument = {
				roomId: 'test-room',
				phase: 'playing',
				currentRound: 0,
				seed: 42,
				dealerIndex: 0,
				moves: [],
				playerIds,
				roundScores: [],
				gameSpecific: createInitialSpadesState({ playerIds, dealerIndex: 0 }),
				lastUpdate: Date.now()
			};

			const bid = computeSpadesAiBidForDoc(doc, 'p1');
			expect(bid.playerId).toBe('p1');
			expect(['regular', 'nil', 'blind_nil']).toContain(bid.bidType);
			if (bid.bidType === 'regular') {
				expect(bid.amount).toBeGreaterThanOrEqual(1);
				expect(bid.amount).toBeLessThanOrEqual(13);
			} else {
				expect(bid.amount).toBe(0);
			}

			const directAiBid = computeSpadesAiBid({ hand: [{ suit: 'spades', rank: 14 }] });
			expect(directAiBid.bidType).toBe('regular');
		});
	});
});

