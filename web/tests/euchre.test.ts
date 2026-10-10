import { describe, it, expect } from 'bun:test';
import {
	euchreRuntime,
	dealEuchre,
	isRightBower,
	isLeftBower,
	isTrumpCard,
	getEffectiveSuit,
	getPlayableEuchreCards,
	resolveEuchreTrick,
	calculateEuchreRoundScores,
	evaluateEuchreHand,
	computeEuchreAiTrumpCall,
	computeEuchreAiMove,
	deriveEuchreState
} from '../src/lib/games/euchre/index.ts';
import type { Card, Move, TrickPlay } from '$lib/platform/types/card';

describe('Euchre Game Engine', () => {
	it('exposes valid GameRuntime contract metadata', () => {
		expect(euchreRuntime.id).toBe('euchre');
		expect(euchreRuntime.name).toBe('Euchre');
		expect(euchreRuntime.minPlayers).toBe(4);
		expect(euchreRuntime.maxPlayers).toBe(4);
		expect(euchreRuntime.totalRounds).toBe(0);
		expect(euchreRuntime.getRoundLabel(0)).toBe('Round 1');
		expect(euchreRuntime.getRoundRules(0)).toContain('Bower');
	});

	describe('1. Deal Determinism & 24-Card Deck', () => {
		it('deals 5 cards each to 4 players from 24-card deck (9..A) with 4 kitty cards', () => {
			const deal = dealEuchre(1234);
			expect(deal.hands.length).toBe(4);
			expect(deal.removedCards.length).toBe(4);
			expect(deal.kitty.length).toBe(4);
			expect(deal.upcard).toEqual(deal.kitty[0]);

			for (const h of deal.hands) {
				expect(h.length).toBe(5);
				for (const c of h) {
					expect(c.rank).toBeGreaterThanOrEqual(9);
					expect(c.rank).toBeLessThanOrEqual(14);
				}
			}

			const all = [...deal.hands.flat(), ...deal.kitty];
			expect(all.length).toBe(24);
			expect(new Set(all.map((c) => `${c.suit}:${c.rank}`)).size).toBe(24);
		});
	});

	describe('2. Dynamic Right & Left Bower Hierarchy', () => {
		it('correctly identifies Right and Left Bowers for red suits (Hearts trump)', () => {
			const rightBower: Card = { suit: 'hearts', rank: 11 };
			const leftBower: Card = { suit: 'diamonds', rank: 11 };
			const offJack1: Card = { suit: 'spades', rank: 11 };
			const offJack2: Card = { suit: 'clubs', rank: 11 };

			expect(isRightBower(rightBower, 'hearts')).toBe(true);
			expect(isLeftBower(leftBower, 'hearts')).toBe(true);
			expect(isTrumpCard(leftBower, 'hearts')).toBe(true);

			expect(isRightBower(leftBower, 'hearts')).toBe(false);
			expect(isLeftBower(rightBower, 'hearts')).toBe(false);
			expect(isTrumpCard(offJack1, 'hearts')).toBe(false);
			expect(isTrumpCard(offJack2, 'hearts')).toBe(false);
		});

		it('correctly identifies Right and Left Bowers for black suits (Clubs trump)', () => {
			const rightBower: Card = { suit: 'clubs', rank: 11 };
			const leftBower: Card = { suit: 'spades', rank: 11 };

			expect(isRightBower(rightBower, 'clubs')).toBe(true);
			expect(isLeftBower(leftBower, 'clubs')).toBe(true);
			expect(isTrumpCard(leftBower, 'clubs')).toBe(true);
			expect(getEffectiveSuit(leftBower, 'clubs')).toBe('clubs');
		});

		it('resolves trick winner where Right Bower beats Left Bower and Left Bower beats Ace of trump', () => {
			// Trump is Spades: Right Bower is J♠, Left Bower is J♣
			const plays: TrickPlay[] = [
				{ playerId: 'p0', card: { suit: 'spades', rank: 14 } }, // Ace trump
				{ playerId: 'p1', card: { suit: 'clubs', rank: 11 } },  // Left Bower (J♣)!
				{ playerId: 'p2', card: { suit: 'hearts', rank: 14 } },
				{ playerId: 'p3', card: { suit: 'spades', rank: 10 } }
			];
			// Left Bower beats Ace of trump!
			const res1 = resolveEuchreTrick(plays, 'spades');
			expect(res1.winnerId).toBe('p1');
			expect(res1.winningCard).toEqual({ suit: 'clubs', rank: 11 });

			// Right Bower played over Left Bower
			const plays2: TrickPlay[] = [
				{ playerId: 'p0', card: { suit: 'clubs', rank: 11 } },  // Left Bower
				{ playerId: 'p1', card: { suit: 'spades', rank: 11 } }, // Right Bower!
				{ playerId: 'p2', card: { suit: 'spades', rank: 14 } }, // Ace
				{ playerId: 'p3', card: { suit: 'spades', rank: 13 } }  // King
			];
			const res2 = resolveEuchreTrick(plays2, 'spades');
			expect(res2.winnerId).toBe('p1');
			expect(res2.winningCard).toEqual({ suit: 'spades', rank: 11 });
		});
	});

	describe('3. Suit Following Invariants with Left Bower', () => {
		it('forces player to follow suit when trump is led and player holds Left Bower', () => {
			// Trump is Hearts. Left Bower is J♦.
			// Eldest hand leads Hearts (trump).
			// Player holds J♦ and no other cards of Hearts suit.
			// Because J♦ belongs to Hearts (trump suit), player MUST follow suit with J♦!
			const trickPlays: TrickPlay[] = [
				{ playerId: 'p0', card: { suit: 'hearts', rank: 10 } }
			];
			const hand: Card[] = [
				{ suit: 'diamonds', rank: 11 }, // Left Bower (effective Hearts!)
				{ suit: 'spades', rank: 10 },
				{ suit: 'clubs', rank: 9 }
			];

			const playable = getPlayableEuchreCards({
				hand,
				trickPlays,
				trumpSuit: 'hearts'
			});

			expect(playable).toEqual([{ suit: 'diamonds', rank: 11 }]);
		});

		it('allows player to NOT play Left Bower when its printed suit is led if void in printed suit', () => {
			// Trump is Hearts. Left Bower is J♦.
			// Eldest hand leads Diamonds!
			// Player holds J♦, but J♦ belongs to HEARTS, not Diamonds!
			// Player has 0 other Diamonds.
			// Player is VOID in Diamonds! Player is NOT forced to play J♦.
			const trickPlays: TrickPlay[] = [
				{ playerId: 'p0', card: { suit: 'diamonds', rank: 10 } }
			];
			const hand: Card[] = [
				{ suit: 'diamonds', rank: 11 }, // Left Bower (effective Hearts, NOT Diamonds!)
				{ suit: 'spades', rank: 14 },
				{ suit: 'clubs', rank: 9 }
			];

			const playable = getPlayableEuchreCards({
				hand,
				trickPlays,
				trumpSuit: 'hearts'
			});

			// Player is void in Diamonds, so any card in hand can be played!
			expect(playable).toEqual(hand);
		});
	});

	describe('4. Euchre Scoring Math & Go Alone', () => {
		const playerIds = ['p0', 'p1', 'p2', 'p3'];

		it('scores 1 point for Makers winning 3 or 4 tricks', () => {
			const res = calculateEuchreRoundScores({
				playerIds,
				tricksTaken: { p0: 2, p1: 1, p2: 1, p3: 1 }, // Team 1 has 3 tricks
				makerTeam: 'team1',
				goingAlone: false
			});
			expect(res.teamRoundScores.team1).toBe(1);
			expect(res.teamRoundScores.team2).toBe(0);
		});

		it('scores 2 points for Makers winning all 5 tricks (March with partner)', () => {
			const res = calculateEuchreRoundScores({
				playerIds,
				tricksTaken: { p0: 3, p1: 0, p2: 2, p3: 0 }, // Team 1 has 5 tricks
				makerTeam: 'team1',
				goingAlone: false
			});
			expect(res.teamRoundScores.team1).toBe(2);
			expect(res.teamRoundScores.team2).toBe(0);
		});

		it('scores 4 points for Makers winning all 5 tricks alone (Lone March)', () => {
			const res = calculateEuchreRoundScores({
				playerIds,
				tricksTaken: { p0: 5, p1: 0, p2: 0, p3: 0 },
				makerTeam: 'team1',
				goingAlone: true
			});
			expect(res.teamRoundScores.team1).toBe(4);
			expect(res.teamRoundScores.team2).toBe(0);
		});

		it('scores 2 points for Defenders when Makers are Euchred (<3 tricks)', () => {
			const res = calculateEuchreRoundScores({
				playerIds,
				tricksTaken: { p0: 1, p1: 2, p2: 1, p3: 1 }, // Team 1 has 2 tricks, Team 2 has 3
				makerTeam: 'team1',
				goingAlone: false
			});
			// Team 2 (defenders) gets 2 points
			expect(res.teamRoundScores.team1).toBe(0);
			expect(res.teamRoundScores.team2).toBe(2);
		});

		it('detects game over when a team reaches 10 points', () => {
			const res = calculateEuchreRoundScores({
				playerIds,
				tricksTaken: { p0: 3, p1: 0, p2: 1, p3: 1 },
				makerTeam: 'team1',
				goingAlone: false,
				previousCumulative: { team1: 9, team2: 6 }
			});
			expect(res.newCumulativeScores.team1).toBe(10);
			expect(res.isGameOver).toBe(true);
		});
	});

	describe('5. AI Bot Heuristics & Match Simulation', () => {
		it('evaluates hand strength and makes intelligent trump call', () => {
			const dominantHand: Card[] = [
				{ suit: 'hearts', rank: 11 }, // Right Bower
				{ suit: 'diamonds', rank: 11 }, // Left Bower
				{ suit: 'hearts', rank: 14 }, // A♥
				{ suit: 'hearts', rank: 13 }, // K♥
				{ suit: 'spades', rank: 14 }  // Off-suit Ace
			];
			const score = evaluateEuchreHand(dominantHand, 'hearts');
			expect(score).toBeGreaterThanOrEqual(8.0);

			const call = computeEuchreAiTrumpCall({
				hand: dominantHand,
				round: 1,
				upcardSuit: 'hearts',
				isDealer: false
			});
			expect(call.shouldCall).toBe(true);
			expect(call.goAlone).toBe(true);
		});

		it('enforces stick the dealer in round 2', () => {
			const weakHand: Card[] = [
				{ suit: 'hearts', rank: 9 },
				{ suit: 'hearts', rank: 10 },
				{ suit: 'spades', rank: 9 },
				{ suit: 'diamonds', rank: 9 },
				{ suit: 'clubs', rank: 9 }
			];
			const call = computeEuchreAiTrumpCall({
				hand: weakHand,
				round: 2,
				upcardSuit: 'hearts',
				isDealer: true,
				isStickDealer: true
			});
			expect(call.shouldCall).toBe(true);
			expect(call.suit).not.toBe('hearts');
		});

		it('runs a complete 4-player Euchre match headlessly to round completion', () => {
			const playerIds = ['p0', 'p1', 'p2', 'p3'];
			const seed = 7777;
			const moves: Move[] = [];

			for (let trick = 0; trick < 5; trick++) {
				for (let step = 0; step < 4; step++) {
					const state = deriveEuchreState({
						moves,
						seed,
						currentRound: 0,
						playerCount: 4,
						playerIds,
						myId: 'p0',
						dealerIndex: 0
					});

					const activeId = playerIds[state.currentTurnIndex];
					const move = computeEuchreAiMove({
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

			expect(moves.length).toBe(20);
			const finalState = deriveEuchreState({
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
