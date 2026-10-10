import type { Card } from '$lib/platform/types/card';
import {
	GIN_BONUS,
	BIG_GIN_BONUS,
	UNDERCUT_BONUS,
	type GinRoundScoring,
	type LayoffResult,
	type Meld,
	type MeldPartition
} from './types.ts';

export function ginCardValue(card: Card): number {
	if (card.rank === 14) return 1; // Ace is 1
	if (card.rank >= 10 && card.rank <= 13) return 10; // 10, J, Q, K are 10
	return card.rank;
}

export function ginRunRank(card: Card): number {
	if (card.rank === 14) return 1; // Ace is low (1)
	return card.rank; // 2..13
}

export function cardKey(card: Card): string {
	return `${card.suit}:${card.rank}`;
}

export function calculateDeadwoodPoints(cards: readonly Card[]): number {
	return cards.reduce((sum, c) => sum + ginCardValue(c), 0);
}

export function isValidSet(cards: readonly Card[]): boolean {
	if (cards.length !== 3 && cards.length !== 4) return false;
	const rank = cards[0].rank;
	const suits = new Set<string>();
	for (const c of cards) {
		if (c.rank !== rank) return false;
		if (suits.has(c.suit)) return false; // Must be distinct suits
		suits.add(c.suit);
	}
	return true;
}

export function isValidRun(cards: readonly Card[]): boolean {
	if (cards.length < 3) return false;
	const suit = cards[0].suit;
	const ranks: number[] = [];
	for (const c of cards) {
		if (c.suit !== suit) return false;
		ranks.push(ginRunRank(c));
	}
	// Sort to check strictly consecutive
	ranks.sort((a, b) => a - b);
	for (let i = 1; i < ranks.length; i++) {
		if (ranks[i] !== ranks[i - 1] + 1) return false;
	}
	// Ace is strictly low (1), wrap-around Q-K-A is impossible because A=1, K=13
	return true;
}

export function findCandidateMelds(hand: readonly Card[]): readonly Meld[] {
	const candidates: Meld[] = [];

	// 1. Sets of 3 or 4
	const rankMap = new Map<number, Card[]>();
	for (const c of hand) {
		const list = rankMap.get(c.rank) ?? [];
		list.push(c);
		rankMap.set(c.rank, list);
	}

	for (const cards of rankMap.values()) {
		if (cards.length === 3) {
			candidates.push({ type: 'set', cards });
		} else if (cards.length === 4) {
			// Size 4 set
			candidates.push({ type: 'set', cards });
			// 4 possible size 3 subsets
			for (let i = 0; i < 4; i++) {
				const subset = cards.filter((_, idx) => idx !== i);
				candidates.push({ type: 'set', cards: subset });
			}
		}
	}

	// 2. Runs of 3+
	const suitMap = new Map<string, Card[]>();
	for (const c of hand) {
		const list = suitMap.get(c.suit) ?? [];
		list.push(c);
		suitMap.set(c.suit, list);
	}

	for (const cards of suitMap.values()) {
		if (cards.length < 3) continue;
		// Sort by ginRunRank
		const sorted = [...cards].sort((a, b) => ginRunRank(a) - ginRunRank(b));

		// Find maximal contiguous slices
		let i = 0;
		while (i < sorted.length) {
			let j = i;
			while (j + 1 < sorted.length && ginRunRank(sorted[j + 1]) === ginRunRank(sorted[j]) + 1) {
				j++;
			}
			const len = j - i + 1;
			if (len >= 3) {
				// All sub-slices of length >= 3
				for (let subLen = 3; subLen <= len; subLen++) {
					for (let start = i; start + subLen - 1 <= j; start++) {
						candidates.push({
							type: 'run',
							cards: sorted.slice(start, start + subLen)
						});
					}
				}
			}
			i = j + 1;
		}
	}

	return candidates;
}

export function findOptimalMelds(hand: readonly Card[]): MeldPartition {
	const candidates = findCandidateMelds(hand);

	let bestMelds: readonly Meld[] = [];
	let bestDeadwood: readonly Card[] = [...hand];
	let minDeadwoodPoints = calculateDeadwoodPoints(hand);

	function search(candidateIdx: number, currentMelds: Meld[], usedCardKeys: Set<string>) {
		// Calculate current deadwood
		const deadwoodCards = hand.filter((c) => !usedCardKeys.has(cardKey(c)));
		const points = calculateDeadwoodPoints(deadwoodCards);

		if (points < minDeadwoodPoints) {
			minDeadwoodPoints = points;
			bestMelds = [...currentMelds];
			bestDeadwood = deadwoodCards;
		}

		if (minDeadwoodPoints === 0 && currentMelds.length > 0) {
			// Can't beat 0 deadwood
			return;
		}

		for (let i = candidateIdx; i < candidates.length; i++) {
			const cand = candidates[i];
			// Check if cand overlaps with usedCardKeys
			let overlaps = false;
			for (const c of cand.cards) {
				if (usedCardKeys.has(cardKey(c))) {
					overlaps = true;
					break;
				}
			}
			if (overlaps) continue;

			// Add cand
			for (const c of cand.cards) usedCardKeys.add(cardKey(c));
			currentMelds.push(cand);

			search(i + 1, currentMelds, usedCardKeys);

			// Backtrack
			currentMelds.pop();
			for (const c of cand.cards) usedCardKeys.delete(cardKey(c));
		}
	}

	search(0, [], new Set());

	return {
		melds: bestMelds,
		deadwood: bestDeadwood,
		deadwoodPoints: minDeadwoodPoints
	};
}

export function computeLayoffs(
	defenderDeadwood: readonly Card[],
	knockerMelds: readonly Meld[]
): LayoffResult {
	const laidOffCards: Card[] = [];
	const remainingDeadwood = [...defenderDeadwood];

	// Make mutable copies of knocker meld card lists
	const mutableMelds = knockerMelds.map((m) => ({
		type: m.type,
		cards: [...m.cards]
	}));

	let changed = true;
	while (changed) {
		changed = false;
		for (let i = 0; i < remainingDeadwood.length; i++) {
			const card = remainingDeadwood[i];
			let canLayOff = false;

			for (const meld of mutableMelds) {
				if (meld.type === 'set') {
					if (meld.cards.length < 4 && meld.cards[0].rank === card.rank) {
						meld.cards.push(card);
						canLayOff = true;
						break;
					}
				} else if (meld.type === 'run') {
					if (meld.cards[0].suit === card.suit) {
						const sortedRanks = meld.cards.map(ginRunRank).sort((a, b) => a - b);
						const minRank = sortedRanks[0];
						const maxRank = sortedRanks[sortedRanks.length - 1];
						const cRank = ginRunRank(card);

						if (cRank === minRank - 1 && cRank >= 1) {
							meld.cards.unshift(card);
							canLayOff = true;
							break;
						} else if (cRank === maxRank + 1 && cRank <= 13) {
							meld.cards.push(card);
							canLayOff = true;
							break;
						}
					}
				}
			}

			if (canLayOff) {
				laidOffCards.push(card);
				remainingDeadwood.splice(i, 1);
				changed = true;
				break;
			}
		}
	}

	return {
		laidOffCards,
		remainingDeadwood,
		remainingDeadwoodPoints: calculateDeadwoodPoints(remainingDeadwood)
	};
}

export function evaluateGinRound(params: {
	knockerId: string;
	defenderId: string;
	knockerHand: readonly Card[];
	defenderHand: readonly Card[];
	isBigGin?: boolean;
}): GinRoundScoring {
	const { knockerId, defenderId, knockerHand, defenderHand, isBigGin = false } = params;

	const knockerPartition = findOptimalMelds(knockerHand);
	const defenderPartition = findOptimalMelds(defenderHand);

	const knockerDeadwood = knockerPartition.deadwoodPoints;
	const defenderInitialDeadwood = defenderPartition.deadwoodPoints;

	const isGin = knockerDeadwood === 0;

	if (isGin) {
		const bonus = isBigGin ? BIG_GIN_BONUS : GIN_BONUS;
		const pointsWon = defenderInitialDeadwood + bonus;
		return {
			knockerId,
			defenderId,
			winnerId: knockerId,
			pointsWon,
			isGin: true,
			isBigGin,
			isUndercut: false,
			knockerDeadwood: 0,
			defenderInitialDeadwood,
			defenderDeadwoodAfterLayoffs: defenderInitialDeadwood,
			layoffs: [],
			description: isBigGin
				? `Big Gin! Knocker wins ${defenderInitialDeadwood} + ${BIG_GIN_BONUS} bonus = ${pointsWon} pts`
				: `Gin! Knocker wins ${defenderInitialDeadwood} + ${GIN_BONUS} bonus = ${pointsWon} pts`
		};
	}

	// Normal knock: Defender may lay off
	const layoffResult = computeLayoffs(defenderPartition.deadwood, knockerPartition.melds);
	const defenderDeadwoodAfterLayoffs = layoffResult.remainingDeadwoodPoints;

	if (knockerDeadwood < defenderDeadwoodAfterLayoffs) {
		const pointsWon = defenderDeadwoodAfterLayoffs - knockerDeadwood;
		return {
			knockerId,
			defenderId,
			winnerId: knockerId,
			pointsWon,
			isGin: false,
			isBigGin: false,
			isUndercut: false,
			knockerDeadwood,
			defenderInitialDeadwood,
			defenderDeadwoodAfterLayoffs,
			layoffs: layoffResult.laidOffCards,
			description: `Knock: Knocker scores ${defenderDeadwoodAfterLayoffs} - ${knockerDeadwood} = ${pointsWon} pts`
		};
	}

	// Defender undercuts!
	const diff = knockerDeadwood - defenderDeadwoodAfterLayoffs;
	const pointsWon = diff + UNDERCUT_BONUS;
	return {
		knockerId,
		defenderId,
		winnerId: defenderId,
		pointsWon,
		isGin: false,
		isBigGin: false,
		isUndercut: true,
		knockerDeadwood,
		defenderInitialDeadwood,
		defenderDeadwoodAfterLayoffs,
		layoffs: layoffResult.laidOffCards,
		description: `Undercut! Defender scores ${diff} + ${UNDERCUT_BONUS} bonus = ${pointsWon} pts`
	};
}
