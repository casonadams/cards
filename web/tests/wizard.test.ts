import { describe, it, expect } from 'bun:test';
import {
	wizardRuntime,
	createWizardDeck,
	dealWizard,
	isWizard,
	isJester,
	isStandardCard,
	WIZARD_RANK,
	JESTER_RANK,
	getPlayableWizardCards,
	resolveWizardTrick,
	calculateWizardRoundScores,
	evaluateWizardHand,
	computeWizardAiMove,
	deriveWizardState
} from '../src/lib/games/wizard/index.ts';
import type { Card, Move, TrickPlay } from '$lib/platform/types/card';
import type { WizardPlayerBid } from '../src/lib/games/wizard/types.ts';

describe('Wizard Game Engine', () => {
	it('exposes valid GameRuntime contract metadata', () => {
		expect(wizardRuntime.id).toBe('wizard');
		expect(wizardRuntime.name).toBe('Wizard');
		expect(wizardRuntime.minPlayers).toBe(3);
		expect(wizardRuntime.maxPlayers).toBe(6);
		expect(wizardRuntime.getRoundLabel(0)).toBe('Round 1 (1 cards)');
		expect(wizardRuntime.getRoundRules(0)).toContain('Wizard');
	});

	describe('1. 60-Card Deck & Progressive Dealing', () => {
		it('contains exactly 60 cards: 52 standard + 4 Wizards + 4 Jesters', () => {
			const deck = createWizardDeck();
			expect(deck.length).toBe(60);

			const wizards = deck.filter(isWizard);
			const jesters = deck.filter(isJester);
			const standard = deck.filter(isStandardCard);

			expect(wizards.length).toBe(4);
			expect(jesters.length).toBe(4);
			expect(standard.length).toBe(52);
		});

		it('deals progressive hand counts per round', () => {
			// Round 0 (Round 1): 1 card each
			const dealR0 = dealWizard({ playerCount: 4, currentRound: 0, seed: 100 });
			expect(dealR0.hands.length).toBe(4);
			for (const h of dealR0.hands) expect(h.length).toBe(1);
			expect(dealR0.remainderDeck.length).toBe(56);
			expect(dealR0.trumpCard).not.toBeNull();

			// Round 4 (Round 5): 5 cards each
			const dealR4 = dealWizard({ playerCount: 4, currentRound: 4, seed: 100 });
			for (const h of dealR4.hands) expect(h.length).toBe(5);
			expect(dealR4.remainderDeck.length).toBe(40);
		});

		it('resolves No Trump when Jester is turned up', () => {
			let foundSeed = 0;
			for (let s = 0; s < 100; s++) {
				const d = dealWizard({ playerCount: 4, currentRound: 0, seed: s });
				if (d.trumpCard && isJester(d.trumpCard)) {
					foundSeed = s;
					break;
				}
			}
			const deal = dealWizard({ playerCount: 4, currentRound: 0, seed: foundSeed });
			expect(isJester(deal.trumpCard!)).toBe(true);
			expect(deal.trumpSuit).toBeNull();
		});

		it('resolves final round (all 60 cards dealt) to No Trump with empty remainder deck', () => {
			// In 4-player game, total rounds = 15. Round 14 deals 15 cards each (4 * 15 = 60 cards).
			const dealFinal = dealWizard({ playerCount: 4, currentRound: 14, seed: 555 });
			for (const h of dealFinal.hands) expect(h.length).toBe(15);
			expect(dealFinal.remainderDeck.length).toBe(0);
			expect(dealFinal.trumpCard).toBeNull();
			expect(dealFinal.trumpSuit).toBeNull();
		});
	});

	describe('2. Wizard & Jester Card Hierarchy & Play Rules', () => {
		it('awards trick to the FIRST Wizard played when multiple Wizards are played', () => {
			const plays: TrickPlay[] = [
				{ playerId: 'p0', card: { suit: 'hearts', rank: WIZARD_RANK } }, // 1st Wizard -> WINS!
				{ playerId: 'p1', card: { suit: 'spades', rank: 14 } },          // Ace Spades (trump)
				{ playerId: 'p2', card: { suit: 'diamonds', rank: WIZARD_RANK } }, // 2nd Wizard
				{ playerId: 'p3', card: { suit: 'clubs', rank: 14 } }
			];
			const res = resolveWizardTrick(plays, 'spades');
			expect(res.winnerId).toBe('p0');
			expect(isWizard(res.winningCard)).toBe(true);
		});

		it('resolves Jester lead where the first standard card determines the led suit', () => {
			const plays: TrickPlay[] = [
				{ playerId: 'p0', card: { suit: 'hearts', rank: JESTER_RANK } }, // Jester led!
				{ playerId: 'p1', card: { suit: 'diamonds', rank: 7 } },         // 1st standard card -> Diamonds led!
				{ playerId: 'p2', card: { suit: 'diamonds', rank: 13 } },        // K♦ -> WINS!
				{ playerId: 'p3', card: { suit: 'diamonds', rank: 10 } }
			];
			const res = resolveWizardTrick(plays, 'clubs');
			expect(res.winnerId).toBe('p2');
			expect(res.winningCard).toEqual({ suit: 'diamonds', rank: 13 });
		});

		it('awards trick to FIRST Jester played when ALL cards played are Jesters', () => {
			const plays: TrickPlay[] = [
				{ playerId: 'p0', card: { suit: 'hearts', rank: JESTER_RANK } }, // 1st Jester -> WINS!
				{ playerId: 'p1', card: { suit: 'diamonds', rank: JESTER_RANK } },
				{ playerId: 'p2', card: { suit: 'spades', rank: JESTER_RANK } },
				{ playerId: 'p3', card: { suit: 'clubs', rank: JESTER_RANK } }
			];
			const res = resolveWizardTrick(plays, 'hearts');
			expect(res.winnerId).toBe('p0');
		});

		it('allows Wizard and Jester to be played ANYTIME regardless of led suit', () => {
			// Led suit is Clubs.
			const trickPlays: TrickPlay[] = [
				{ playerId: 'p0', card: { suit: 'clubs', rank: 10 } }
			];
			// Hand has Clubs (must follow suit normally), but also holds a Wizard and Jester
			const hand: Card[] = [
				{ suit: 'clubs', rank: 7 },
				{ suit: 'diamonds', rank: 14 },
				{ suit: 'spades', rank: WIZARD_RANK }, // Wizard
				{ suit: 'hearts', rank: JESTER_RANK }  // Jester
			];

			const playable = getPlayableWizardCards({ hand, trickPlays });
			// Wizard, Jester, and 7♣ must all be legally playable!
			// 14♦ is illegal because player has 7♣
			expect(playable).toContainEqual({ suit: 'spades', rank: WIZARD_RANK });
			expect(playable).toContainEqual({ suit: 'hearts', rank: JESTER_RANK });
			expect(playable).toContainEqual({ suit: 'clubs', rank: 7 });
			expect(playable).not.toContainEqual({ suit: 'diamonds', rank: 14 });
		});
	});

	describe('3. Exact Bid Scoring Math', () => {
		const playerIds = ['p0', 'p1', 'p2', 'p3'];

		it('awards +20 + 10/trick for exact bids', () => {
			const bids: WizardPlayerBid[] = [
				{ playerId: 'p0', bid: 0 },
				{ playerId: 'p1', bid: 2 },
				{ playerId: 'p2', bid: 1 },
				{ playerId: 'p3', bid: 3 }
			];
			const tricksTaken = { p0: 0, p1: 2, p2: 1, p3: 3 };

			const res = calculateWizardRoundScores({
				playerIds,
				bids,
				tricksTaken
			});

			// p0: bid 0, won 0 = +20
			expect(res.roundScores.find((s) => s.playerId === 'p0')?.points).toBe(20);
			// p1: bid 2, won 2 = +20 + 20 = +40
			expect(res.roundScores.find((s) => s.playerId === 'p1')?.points).toBe(40);
			// p2: bid 1, won 1 = +20 + 10 = +30
			expect(res.roundScores.find((s) => s.playerId === 'p2')?.points).toBe(30);
			// p3: bid 3, won 3 = +20 + 30 = +50
			expect(res.roundScores.find((s) => s.playerId === 'p3')?.points).toBe(50);
		});

		it('penalizes -10 per trick difference for missed bids', () => {
			const bids: WizardPlayerBid[] = [
				{ playerId: 'p0', bid: 2 }, // won 0 -> error 2 -> -20
				{ playerId: 'p1', bid: 0 }, // won 1 -> error 1 -> -10
				{ playerId: 'p2', bid: 1 }, // won 3 -> error 2 -> -20
				{ playerId: 'p3', bid: 3 }  // won 3 -> exact -> +50
			];
			const tricksTaken = { p0: 0, p1: 1, p2: 3, p3: 3 };

			const res = calculateWizardRoundScores({
				playerIds,
				bids,
				tricksTaken
			});

			expect(res.roundScores.find((s) => s.playerId === 'p0')?.points).toBe(-20);
			expect(res.roundScores.find((s) => s.playerId === 'p1')?.points).toBe(-10);
			expect(res.roundScores.find((s) => s.playerId === 'p2')?.points).toBe(-20);
			expect(res.roundScores.find((s) => s.playerId === 'p3')?.points).toBe(50);
		});
	});

	describe('4. AI Bot Heuristics & Match Simulation', () => {
		it('evaluates hand strength for bidding', () => {
			const hand: Card[] = [
				{ suit: 'hearts', rank: WIZARD_RANK }, // 1 trick
				{ suit: 'spades', rank: 14 },          // Trump Ace: 0.8 trick
				{ suit: 'clubs', rank: JESTER_RANK }   // 0 tricks
			];
			const bid = evaluateWizardHand(hand, 'spades');
			expect(bid).toBe(2);
		});

		it('simulates a complete 3-player Wizard match round headlessly', () => {
			const playerIds = ['p0', 'p1', 'p2'];
			const seed = 3333;
			const round = 2; // 3 cards each (Round 3)
			const moves: Move[] = [];

			for (let trick = 0; trick < 3; trick++) {
				for (let step = 0; step < 3; step++) {
					const state = deriveWizardState({
						moves,
						seed,
						currentRound: round,
						playerCount: 3,
						playerIds,
						myId: 'p0',
						dealerIndex: 0
					});

					const activeId = playerIds[state.currentTurnIndex];
					const move = computeWizardAiMove({
						moves,
						seed,
						currentRound: round,
						playerCount: 3,
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

			expect(moves.length).toBe(9);
			const finalState = deriveWizardState({
				moves,
				seed,
				currentRound: round,
				playerCount: 3,
				playerIds,
				myId: 'p0',
				dealerIndex: 0
			});

			expect(finalState.isRoundComplete).toBe(true);
			expect(finalState.roundScores).not.toBeNull();
			expect(finalState.roundScores?.length).toBe(3);
		});

		it('simulates a complete 4-player Wizard match round headlessly', () => {
			const playerIds = ['p0', 'p1', 'p2', 'p3'];
			const seed = 4444;
			const round = 1; // 2 cards each
			const moves: Move[] = [];

			for (let trick = 0; trick < 2; trick++) {
				for (let step = 0; step < 4; step++) {
					const state = deriveWizardState({
						moves,
						seed,
						currentRound: round,
						playerCount: 4,
						playerIds,
						myId: 'p0',
						dealerIndex: 0
					});

					const activeId = playerIds[state.currentTurnIndex];
					const move = computeWizardAiMove({
						moves,
						seed,
						currentRound: round,
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

			expect(moves.length).toBe(8);
			const finalState = deriveWizardState({
				moves,
				seed,
				currentRound: round,
				playerCount: 4,
				playerIds,
				myId: 'p0',
				dealerIndex: 0
			});

			expect(finalState.isRoundComplete).toBe(true);
		});
	});
});
