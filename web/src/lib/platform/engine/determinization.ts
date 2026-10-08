import type { Card } from '../types/index.ts';
import type { Move } from './game-sync.ts';

export function trackPlayerVoids(
	moves: readonly Move[],
	playerCount: number,
	playerIds: readonly string[]
): Map<string, Set<string>> {
	const voids = new Map<string, Set<string>>();
	for (const id of playerIds) {
		voids.set(id, new Set());
	}
	let i = 0;
	while (i < moves.length) {
		const trickMoves = moves.slice(i, i + playerCount);
		if (trickMoves.length === 0) break;
		const ledSuit = trickMoves[0].card.suit;
		for (let j = 1; j < trickMoves.length; j++) {
			const m = trickMoves[j];
			if (m.card.suit !== ledSuit) {
				voids.get(m.playerId)?.add(ledSuit);
			}
		}
		i += playerCount;
	}
	return voids;
}

export interface OpponentNeed {
	readonly id: string;
	readonly needed: number;
	readonly voids: ReadonlySet<string>;
}

export function sampleOpponentHands(
	opponents: readonly OpponentNeed[],
	unseenPool: readonly Card[]
): Map<string, Card[]> {
	const result = new Map<string, Card[]>();
	const pool = unseenPool.slice();
	for (let i = pool.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const t = pool[i];
		pool[i] = pool[j];
		pool[j] = t;
	}
	for (const opp of opponents) {
		result.set(opp.id, []);
	}
	const sortedOpps = opponents.slice().sort((a, b) => b.voids.size - a.voids.size);
	const used = new Uint8Array(pool.length);
	for (const opp of sortedOpps) {
		const hand = result.get(opp.id)!;
		for (let i = 0; i < pool.length && hand.length < opp.needed; i++) {
			if (!used[i] && !opp.voids.has(pool[i].suit)) {
				used[i] = 1;
				hand.push(pool[i]);
			}
		}
	}
	for (const opp of sortedOpps) {
		const hand = result.get(opp.id)!;
		for (let i = 0; i < pool.length && hand.length < opp.needed; i++) {
			if (!used[i]) {
				used[i] = 1;
				hand.push(pool[i]);
			}
		}
	}
	return result;
}
