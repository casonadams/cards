import {
	sampleOpponentHands,
	type TrickPlay,
	type Move,
	type OpponentNeed
} from '$lib/platform/engine/index';
import type { Card, Suit } from '$lib/platform/types/index';
import { resolveOhWellTrick } from './trick.ts';

function evalStrength(card: Card, ledSuit: Suit | null, trumpSuit: Suit | null): number {
	if (trumpSuit && card.suit === trumpSuit) return 100 + card.rank;
	if (ledSuit && card.suit === ledSuit) return card.rank;
	return -1;
}

function selectLeadPlay(hand: Card[], trumpSuit: Suit | null, needsTrick: boolean): Card {
	if (needsTrick) {
		return hand.reduce((max, c) =>
			evalStrength(c, c.suit, trumpSuit) > evalStrength(max, max.suit, trumpSuit) ? c : max
		);
	}
	const nonTrumps = trumpSuit ? hand.filter((c) => c.suit !== trumpSuit) : hand;
	return (nonTrumps.length > 0 ? nonTrumps : hand).reduce((min, c) =>
		c.rank < min.rank ? c : min
	);
}

function selectFollowPlay(
	onSuit: Card[],
	ledSuit: Suit,
	winningStrength: number,
	trumpSuit: Suit | null,
	needsTrick: boolean
): Card {
	if (needsTrick) {
		const winners = onSuit.filter((c) => evalStrength(c, ledSuit, trumpSuit) > winningStrength);
		if (winners.length > 0) {
			return winners.reduce((min, c) => (c.rank < min.rank ? c : min));
		}
		return onSuit.reduce((min, c) => (c.rank < min.rank ? c : min));
	}
	const ducks = onSuit.filter((c) => evalStrength(c, ledSuit, trumpSuit) < winningStrength);
	if (ducks.length > 0) {
		return ducks.reduce((max, c) => (c.rank > max.rank ? c : max));
	}
	return onSuit.reduce((max, c) => (c.rank > max.rank ? c : max));
}

function selectSluffPlay(
	hand: Card[],
	ledSuit: Suit,
	winningStrength: number,
	trumpSuit: Suit | null,
	needsTrick: boolean
): Card {
	if (needsTrick) {
		const trumps = trumpSuit ? hand.filter((c) => c.suit === trumpSuit) : [];
		const winningTrumps = trumps.filter(
			(c) => evalStrength(c, ledSuit, trumpSuit) > winningStrength
		);
		if (winningTrumps.length > 0) {
			return winningTrumps.reduce((min, c) => (c.rank < min.rank ? c : min));
		}
		const nonTrumps = trumpSuit ? hand.filter((c) => c.suit !== trumpSuit) : hand;
		return (nonTrumps.length > 0 ? nonTrumps : hand).reduce((min, c) =>
			c.rank < min.rank ? c : min
		);
	}
	const nonTrumps = trumpSuit ? hand.filter((c) => c.suit !== trumpSuit) : hand;
	return (nonTrumps.length > 0 ? nonTrumps : hand).reduce((max, c) =>
		c.rank > max.rank ? c : max
	);
}

function selectRolloutPlay(
	hand: Card[],
	ledSuit: Suit | null,
	winningStrength: number,
	trumpSuit: Suit | null,
	needsTrick: boolean
): Card {
	if (!ledSuit) return selectLeadPlay(hand, trumpSuit, needsTrick);
	const onSuit = hand.filter((c) => c.suit === ledSuit);
	if (onSuit.length > 0) {
		return selectFollowPlay(onSuit, ledSuit, winningStrength, trumpSuit, needsTrick);
	}
	return selectSluffPlay(hand, ledSuit, winningStrength, trumpSuit, needsTrick);
}

function simulateRemainingTricks(
	hands: Map<string, Card[]>,
	playerIds: readonly string[],
	initialLeaderId: string,
	trumpSuit: Suit | null,
	bids: ReadonlyMap<string, number>,
	takenCounts: Map<string, number>
): void {
	let leaderId = initialLeaderId;
	const cardsLeft = hands.get(playerIds[0])?.length ?? 0;
	for (let t = 0; t < cardsLeft; t++) {
		const plays: TrickPlay[] = [];
		const startIdx = playerIds.indexOf(leaderId);
		let ledSuit: Suit | null = null;
		let winningStrength = -1;

		for (let i = 0; i < playerIds.length; i++) {
			const pid = playerIds[(startIdx + i) % playerIds.length];
			const h = hands.get(pid)!;
			const needsTrick = (takenCounts.get(pid) ?? 0) < (bids.get(pid) ?? 0);
			const card = selectRolloutPlay(h, ledSuit, winningStrength, trumpSuit, needsTrick);
			h.splice(h.indexOf(card), 1);
			if (i === 0) {
				ledSuit = card.suit;
				winningStrength = evalStrength(card, ledSuit, trumpSuit);
			} else {
				const str = evalStrength(card, ledSuit, trumpSuit);
				if (str > winningStrength) winningStrength = str;
			}
			plays.push({ playerId: pid, card });
		}
		const res = resolveOhWellTrick(plays, trumpSuit);
		leaderId = res.winnerId;
		takenCounts.set(leaderId, (takenCounts.get(leaderId) ?? 0) + 1);
	}
}

function simulateRollout(
	candidate: Card,
	hands: Map<string, Card[]>,
	currentTrick: readonly TrickPlay[],
	playerIds: readonly string[],
	trumpSuit: Suit | null,
	bids: ReadonlyMap<string, number>,
	initialTaken: ReadonlyMap<string, number>,
	aiId: string
): number {
	const clonedHands = new Map<string, Card[]>();
	for (const [k, v] of hands) clonedHands.set(k, v.slice());
	const taken = new Map(initialTaken);

	const aiHand = clonedHands.get(aiId)!;
	const cIdx = aiHand.findIndex((c) => c.suit === candidate.suit && c.rank === candidate.rank);
	if (cIdx >= 0) aiHand.splice(cIdx, 1);

	const plays = currentTrick.map((p) => ({ ...p }));
	const ledSuit = (plays.length > 0 ? plays[0].card.suit : candidate.suit) as Suit;
	let currentWinner = plays.length > 0 ? resolveOhWellTrick(plays, trumpSuit) : null;
	plays.push({ playerId: aiId, card: candidate });

	let winningStrength = currentWinner
		? evalStrength(currentWinner.winningCard, ledSuit, trumpSuit)
		: -1;
	const candidateStr = evalStrength(candidate, ledSuit, trumpSuit);
	if (candidateStr > winningStrength) {
		currentWinner = { winnerId: aiId, winningCard: candidate };
		winningStrength = candidateStr;
	}

	const aiIdx = playerIds.indexOf(aiId);
	const remainingToPlay = playerIds.length - plays.length;
	for (let step = 1; step <= remainingToPlay; step++) {
		const nextPid = playerIds[(aiIdx + step) % playerIds.length];
		const h = clonedHands.get(nextPid)!;
		const needsTrick = (taken.get(nextPid) ?? 0) < (bids.get(nextPid) ?? 0);
		const card = selectRolloutPlay(h, ledSuit, winningStrength, trumpSuit, needsTrick);
		h.splice(h.indexOf(card), 1);
		plays.push({ playerId: nextPid, card });
		const str = evalStrength(card, ledSuit, trumpSuit);
		if (str > winningStrength) {
			currentWinner = { winnerId: nextPid, winningCard: card };
			winningStrength = str;
		}
	}

	const trickWinner = resolveOhWellTrick(plays, trumpSuit).winnerId;
	taken.set(trickWinner, (taken.get(trickWinner) ?? 0) + 1);

	simulateRemainingTricks(clonedHands, playerIds, trickWinner, trumpSuit, bids, taken);

	const aiFinalTaken = taken.get(aiId) ?? 0;
	const aiBid = bids.get(aiId) ?? 0;
	const diff = Math.abs(aiFinalTaken - aiBid);
	return diff === 0 ? 10 + aiBid : -diff * 3;
}

export interface OhWellAiSimulationParams {
	readonly candidates: readonly Card[];
	readonly aiHand: readonly Card[];
	readonly currentTrick: readonly TrickPlay[];
	readonly moves: readonly Move[];
	readonly playerIds: readonly string[];
	readonly aiId: string;
	readonly trumpSuit: Suit | null;
	readonly bids: ReadonlyMap<string, number>;
	readonly takenCounts: ReadonlyMap<string, number>;
	readonly cardsPerPlayer: number;
	readonly allDealtCards: readonly Card[];
	readonly voids: ReadonlyMap<string, ReadonlySet<string>>;
}

export function simulateBestOhWellCard(params: OhWellAiSimulationParams): Card {
	const { candidates, aiHand, currentTrick, moves, playerIds, aiId, trumpSuit, bids, takenCounts } =
		params;
	if (candidates.length <= 1) return candidates[0] ?? aiHand[0];

	const playedCards = new Set(moves.map((m) => `${m.card.rank}_${m.card.suit}`));
	const aiCards = new Set(aiHand.map((c) => `${c.rank}_${c.suit}`));
	const unseenPool = params.allDealtCards.filter(
		(c) => !playedCards.has(`${c.rank}_${c.suit}`) && !aiCards.has(`${c.rank}_${c.suit}`)
	);

	const opponents: OpponentNeed[] = [];
	for (const pid of playerIds) {
		if (pid === aiId) continue;
		const playedCount = moves.filter((m) => m.playerId === pid).length;
		const needed = params.cardsPerPlayer - playedCount;
		opponents.push({ id: pid, needed, voids: params.voids.get(pid) ?? new Set() });
	}

	const ITERATIONS = 40;
	const utilities = new Map<Card, number>();
	for (const c of candidates) utilities.set(c, 0);

	for (let it = 0; it < ITERATIONS; it++) {
		const sampled = sampleOpponentHands(opponents, unseenPool);
		sampled.set(aiId, aiHand.slice());
		for (const candidate of candidates) {
			const util = simulateRollout(
				candidate,
				sampled,
				currentTrick,
				playerIds,
				trumpSuit,
				bids,
				takenCounts,
				aiId
			);
			utilities.set(candidate, (utilities.get(candidate) ?? 0) + util);
		}
	}

	let bestCard = candidates[0];
	let bestUtility = -Infinity;
	for (const candidate of candidates) {
		const util = utilities.get(candidate) ?? -Infinity;
		if (util > bestUtility) {
			bestUtility = util;
			bestCard = candidate;
		}
	}
	return bestCard;
}
