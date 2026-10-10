import type { Card } from '$lib/platform/types/card';
import type { CribbageScoreBreakdown } from './types.ts';

export function cardPipValue(card: Card): number {
	if (card.rank === 14) return 1; // Ace is 1
	if (card.rank >= 10 && card.rank <= 13) return 10; // 10, J, Q, K are 10
	return card.rank;
}

export function cardSequenceRank(card: Card): number {
	if (card.rank === 14) return 1; // Ace is low
	return card.rank; // 2..10, 11 (J), 12 (Q), 13 (K)
}

export function scoreFifteens(cards: readonly Card[]): { points: number; count: number } {
	let count = 0;
	const n = cards.length;
	// All subsets of size >= 2 (1 << n = 32 for 5 cards)
	for (let mask = 1; mask < (1 << n); mask++) {
		let sum = 0;
		let size = 0;
		for (let i = 0; i < n; i++) {
			if ((mask & (1 << i)) !== 0) {
				sum += cardPipValue(cards[i]);
				size++;
			}
		}
		if (size >= 2 && sum === 15) {
			count++;
		}
	}
	return { points: count * 2, count };
}

export function scorePairs(cards: readonly Card[]): { points: number; count: number } {
	let count = 0;
	const n = cards.length;
	for (let i = 0; i < n; i++) {
		for (let j = i + 1; j < n; j++) {
			if (cards[i].rank === cards[j].rank) {
				count++;
			}
		}
	}
	return { points: count * 2, count };
}

export function scoreRuns(cards: readonly Card[]): { points: number; count: number; length: number } {
	const rankCounts = new Map<number, number>();
	for (const card of cards) {
		const r = cardSequenceRank(card);
		rankCounts.set(r, (rankCounts.get(r) ?? 0) + 1);
	}

	// Check contiguous intervals of length >= 3
	let bestPoints = 0;
	let bestCount = 0;
	let bestLength = 0;

	// In 5 cards, search for runs of length 5, 4, 3
	for (let len = 5; len >= 3; len--) {
		for (let start = 1; start <= 14 - len; start++) {
			let isRun = true;
			let multiplier = 1;
			for (let r = start; r < start + len; r++) {
				const c = rankCounts.get(r) ?? 0;
				if (c === 0) {
					isRun = false;
					break;
				}
				multiplier *= c;
			}
			if (isRun) {
				const points = len * multiplier;
				if (points > bestPoints) {
					bestPoints = points;
					bestCount = multiplier;
					bestLength = len;
				}
			}
		}
		if (bestPoints > 0) {
			// Found the longest run length, do not score sub-runs
			break;
		}
	}

	return { points: bestPoints, count: bestCount, length: bestLength };
}

export function scoreFlush(
	handCards: readonly Card[],
	starter: Card,
	isCrib: boolean
): { points: number; isFiveCard: boolean } {
	if (handCards.length !== 4) return { points: 0, isFiveCard: false };
	const suit = handCards[0].suit;
	const handMatches = handCards.every((c) => c.suit === suit);

	if (isCrib) {
		if (handMatches && starter.suit === suit) {
			return { points: 5, isFiveCard: true };
		}
		return { points: 0, isFiveCard: false };
	}

	if (handMatches) {
		if (starter.suit === suit) {
			return { points: 5, isFiveCard: true };
		}
		return { points: 4, isFiveCard: false };
	}

	return { points: 0, isFiveCard: false };
}

export function scoreHisNobs(handCards: readonly Card[], starter: Card): number {
	for (const c of handCards) {
		if (c.rank === 11 && c.suit === starter.suit) {
			return 1;
		}
	}
	return 0;
}

export function scoreCribbageHand(
	handCards: readonly Card[],
	starter: Card,
	isCrib = false
): CribbageScoreBreakdown {
	const allCards = [...handCards, starter];
	const descriptions: string[] = [];

	const fifteens = scoreFifteens(allCards);
	if (fifteens.points > 0) {
		descriptions.push(`Fifteen (${fifteens.count}): +${fifteens.points}`);
	}

	const pairs = scorePairs(allCards);
	if (pairs.points > 0) {
		descriptions.push(`Pairs (${pairs.count}): +${pairs.points}`);
	}

	const runs = scoreRuns(allCards);
	if (runs.points > 0) {
		descriptions.push(`Run of ${runs.length} (${runs.count}): +${runs.points}`);
	}

	const flush = scoreFlush(handCards, starter, isCrib);
	if (flush.points > 0) {
		descriptions.push(`Flush (${flush.points}): +${flush.points}`);
	}

	const nobs = scoreHisNobs(handCards, starter);
	if (nobs > 0) {
		descriptions.push('His Nobs: +1');
	}

	const total = fifteens.points + pairs.points + runs.points + flush.points + nobs;

	return {
		fifteens: fifteens.points,
		pairs: pairs.points,
		runs: runs.points,
		flush: flush.points,
		nobs,
		total,
		descriptions
	};
}

export interface PeggingEvaluation {
	readonly points: number;
	readonly descriptions: readonly string[];
	readonly newTotal: number;
}

export function evaluatePeggingPlay(
	historyInCount: readonly Card[],
	card: Card,
	currentTotal: number
): PeggingEvaluation {
	const newTotal = currentTotal + cardPipValue(card);
	let points = 0;
	const descriptions: string[] = [];

	// 15
	if (newTotal === 15) {
		points += 2;
		descriptions.push('Fifteen for 2');
	}

	// 31
	if (newTotal === 31) {
		points += 2;
		descriptions.push('Thirty-one for 2');
	}

	// Pairs looking backwards
	let sameRankCount = 1;
	for (let i = historyInCount.length - 1; i >= 0; i--) {
		if (historyInCount[i].rank === card.rank) {
			sameRankCount++;
		} else {
			break;
		}
	}
	if (sameRankCount === 2) {
		points += 2;
		descriptions.push('Pair for 2');
	} else if (sameRankCount === 3) {
		points += 6;
		descriptions.push('Three of a kind for 6');
	} else if (sameRankCount === 4) {
		points += 12;
		descriptions.push('Four of a kind for 12');
	}

	// Runs
	const seq = [...historyInCount, card];
	for (let len = seq.length; len >= 3; len--) {
		const slice = seq.slice(seq.length - len);
		const ranks = slice.map((c) => cardSequenceRank(c));
		const uniqueRanks = new Set(ranks);
		if (uniqueRanks.size === len) {
			const min = Math.min(...ranks);
			const max = Math.max(...ranks);
			if (max - min === len - 1) {
				points += len;
				descriptions.push(`Run of ${len} for ${len}`);
				break;
			}
		}
	}

	return {
		points,
		descriptions,
		newTotal
	};
}
