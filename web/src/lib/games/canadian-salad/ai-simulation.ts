import {
	resolveTrick,
	sampleOpponentHands,
	type TrickPlay,
	type Move,
	type OpponentNeed
} from '$lib/platform/engine/index';
import type { Card } from '$lib/platform/types/index';
import type { HandType } from './types.ts';
import { getCardPenalty } from './types.ts';

function trickPenalty(plays: readonly TrickPlay[], isLast: boolean, handType: HandType): number {
	let p = 0;
	if (handType === 'NO_TRICKS' || handType === 'COMBINATION') p += 10;
	if (isLast && (handType === 'NO_LAST_TRICK' || handType === 'COMBINATION')) p += 100;
	for (const play of plays) {
		p += getCardPenalty(play.card, handType);
	}
	return p;
}

function selectRolloutPlay(
	hand: Card[],
	ledSuit: string | null,
	currentWinnerRank: number,
	handType: HandType,
	isLeaderWinning: boolean
): Card {
	if (!ledSuit) {
		const safe = hand.filter((c) => getCardPenalty(c, handType) === 0);
		return (safe.length > 0 ? safe : hand).reduce((min, c) => (c.rank < min.rank ? c : min));
	}
	const onSuit = hand.filter((c) => c.suit === ledSuit);
	if (onSuit.length > 0) {
		const ducks = onSuit.filter((c) => c.rank < currentWinnerRank);
		if (ducks.length > 0) {
			return ducks.reduce((max, c) => (c.rank > max.rank ? c : max));
		}
		return onSuit.reduce((min, c) => (c.rank < min.rank ? c : min));
	}
	if (!isLeaderWinning) {
		const penalties = hand.filter((c) => getCardPenalty(c, handType) > 0);
		if (penalties.length > 0) {
			return penalties.reduce((max, c) =>
				getCardPenalty(c, handType) > getCardPenalty(max, handType) ? c : max
			);
		}
	}
	return hand.reduce((max, c) => (c.rank > max.rank ? c : max));
}

function simulateRemainingTricks(
	hands: Map<string, Card[]>,
	playerIds: readonly string[],
	initialLeaderId: string,
	handType: HandType,
	aiId: string
): number {
	let leaderId = initialLeaderId;
	let aiPenalty = 0;
	const cardsLeft = hands.get(aiId)?.length ?? 0;
	for (let t = 0; t < cardsLeft; t++) {
		const isLast = t === cardsLeft - 1;
		const plays: TrickPlay[] = [];
		const startIdx = playerIds.indexOf(leaderId);
		let ledSuit: string | null = null;
		let winningRank = 0;

		for (let i = 0; i < playerIds.length; i++) {
			const pid = playerIds[(startIdx + i) % playerIds.length];
			const h = hands.get(pid)!;
			const card = selectRolloutPlay(h, ledSuit, winningRank, handType, pid === leaderId);
			h.splice(h.indexOf(card), 1);
			if (i === 0) {
				ledSuit = card.suit;
				winningRank = card.rank;
			} else if (card.suit === ledSuit && card.rank > winningRank) {
				winningRank = card.rank;
			}
			plays.push({ playerId: pid, card });
		}
		const res = resolveTrick(plays);
		leaderId = res.winnerId;
		if (leaderId === aiId) {
			aiPenalty += trickPenalty(plays, isLast, handType);
		}
	}
	return aiPenalty;
}

function simulateRollout(
	candidate: Card,
	hands: Map<string, Card[]>,
	currentTrick: readonly TrickPlay[],
	playerIds: readonly string[],
	handType: HandType,
	aiId: string
): number {
	const clonedHands = new Map<string, Card[]>();
	for (const [k, v] of hands) clonedHands.set(k, v.slice());

	const aiHand = clonedHands.get(aiId)!;
	const cIdx = aiHand.findIndex((c) => c.suit === candidate.suit && c.rank === candidate.rank);
	if (cIdx >= 0) aiHand.splice(cIdx, 1);

	const plays = currentTrick.map((p) => ({ ...p }));
	const ledSuit = plays.length > 0 ? plays[0].card.suit : candidate.suit;
	let currentWinner = plays.length > 0 ? resolveTrick(plays) : null;
	plays.push({ playerId: aiId, card: candidate });

	if (
		candidate.suit === ledSuit &&
		(!currentWinner || candidate.rank > currentWinner.winningCard.rank)
	) {
		currentWinner = { plays, winnerId: aiId, winningCard: candidate };
	}

	const aiIdx = playerIds.indexOf(aiId);
	const remainingToPlay = playerIds.length - plays.length;
	for (let step = 1; step <= remainingToPlay; step++) {
		const nextPid = playerIds[(aiIdx + step) % playerIds.length];
		const h = clonedHands.get(nextPid)!;
		const winningRank = currentWinner ? currentWinner.winningCard.rank : 0;
		const card = selectRolloutPlay(
			h,
			ledSuit,
			winningRank,
			handType,
			nextPid === currentWinner?.winnerId
		);
		h.splice(h.indexOf(card), 1);
		plays.push({ playerId: nextPid, card });
		if (card.suit === ledSuit && card.rank > winningRank) {
			currentWinner = { plays, winnerId: nextPid, winningCard: card };
		}
	}

	const trickWinner = resolveTrick(plays).winnerId;
	const isLastTrick = (clonedHands.get(aiId)?.length ?? 0) === 0;
	let penalty = trickWinner === aiId ? trickPenalty(plays, isLastTrick, handType) : 0;
	if (!isLastTrick) {
		penalty += simulateRemainingTricks(clonedHands, playerIds, trickWinner, handType, aiId);
	}
	return penalty;
}

export interface CanadianSaladAiSimulationParams {
	readonly candidates: readonly Card[];
	readonly aiHand: readonly Card[];
	readonly currentTrick: readonly TrickPlay[];
	readonly moves: readonly Move[];
	readonly playerIds: readonly string[];
	readonly aiId: string;
	readonly handType: HandType;
	readonly allDealtCards: readonly Card[];
	readonly initialDealCounts: readonly number[];
	readonly voids: ReadonlyMap<string, ReadonlySet<string>>;
}

export function simulateBestCanadianSaladCard(params: CanadianSaladAiSimulationParams): Card {
	const { candidates, aiHand, currentTrick, moves, playerIds, aiId, handType } = params;
	if (candidates.length <= 1) return candidates[0] ?? aiHand[0];

	const playedCards = new Set(moves.map((m) => `${m.card.rank}_${m.card.suit}`));
	const aiCards = new Set(aiHand.map((c) => `${c.rank}_${c.suit}`));
	const unseenPool = params.allDealtCards.filter(
		(c) => !playedCards.has(`${c.rank}_${c.suit}`) && !aiCards.has(`${c.rank}_${c.suit}`)
	);

	const opponents: OpponentNeed[] = [];
	for (let i = 0; i < playerIds.length; i++) {
		const pid = playerIds[i];
		if (pid === aiId) continue;
		const playedCount = moves.filter((m) => m.playerId === pid).length;
		const needed = (params.initialDealCounts[i] ?? 0) - playedCount;
		opponents.push({ id: pid, needed, voids: params.voids.get(pid) ?? new Set() });
	}

	const ITERATIONS = 35;
	let bestCard = candidates[0];
	let lowestPenalty = Infinity;

	for (const candidate of candidates) {
		let totalPenalty = 0;
		for (let it = 0; it < ITERATIONS; it++) {
			const sampled = sampleOpponentHands(opponents, unseenPool);
			sampled.set(aiId, aiHand.slice());
			totalPenalty += simulateRollout(candidate, sampled, currentTrick, playerIds, handType, aiId);
		}
		if (totalPenalty < lowestPenalty) {
			lowestPenalty = totalPenalty;
			bestCard = candidate;
		}
	}
	return bestCard;
}
