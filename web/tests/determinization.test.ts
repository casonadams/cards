import { describe, expect, it } from 'bun:test';
import { trackPlayerVoids, sampleOpponentHands, type OpponentNeed } from '$lib/platform/engine/index.ts';
import type { Move } from '$lib/platform/engine/game-sync.ts';
import type { Card } from '$lib/platform/types/index.ts';

describe('determinization', () => {
	it('tracks suit voids when players do not follow suit', () => {
		const playerIds = ['p0', 'p1', 'p2', 'p3'];
		const moves: Move[] = [
			{ playerId: 'p0', card: { suit: 'spades', rank: 10 }, timestamp: 1 },
			{ playerId: 'p1', card: { suit: 'hearts', rank: 2 }, timestamp: 2 },
			{ playerId: 'p2', card: { suit: 'spades', rank: 14 }, timestamp: 3 },
			{ playerId: 'p3', card: { suit: 'spades', rank: 4 }, timestamp: 4 }
		];
		const voids = trackPlayerVoids(moves, 4, playerIds);
		expect(voids.get('p1')?.has('spades')).toBe(true);
		expect(voids.get('p0')?.has('spades')).toBe(false);
		expect(voids.get('p2')?.has('spades')).toBe(false);
	});

	it('samples opponent hands respecting void constraints', () => {
		const pool: Card[] = [
			{ suit: 'hearts', rank: 10 },
			{ suit: 'hearts', rank: 2 },
			{ suit: 'spades', rank: 5 },
			{ suit: 'spades', rank: 8 }
		];
		const opps: OpponentNeed[] = [
			{ id: 'p1', needed: 2, voids: new Set<string>(['hearts']) },
			{ id: 'p2', needed: 2, voids: new Set<string>() }
		];
		const sampled = sampleOpponentHands(opps, pool);
		const p1Hand = sampled.get('p1')!;
		expect(p1Hand.length).toBe(2);
		expect(p1Hand.every((c) => c.suit === 'spades')).toBe(true);
	});
});
