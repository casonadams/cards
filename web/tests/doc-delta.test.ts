import { describe, expect, it } from 'bun:test';
import { applyDocDelta, diffDoc, isDeltaStale } from '$lib/platform/engine/doc-delta.ts';
import { createLocalP2pSync } from '$lib/platform/adapters/local-p2p-adapters.ts';
import type { GameDocument } from '$lib/platform/engine/game-sync.ts';

const base: GameDocument = {
	roomId: 'room-1',
	phase: 'playing',
	currentRound: 2,
	seed: 42,
	dealerIndex: 1,
	moves: [
		{ playerId: 'a', card: { suit: 'hearts', rank: 2 }, timestamp: 10 },
		{ playerId: 'b', card: { suit: 'hearts', rank: 9 }, timestamp: 11 }
	],
	playerIds: ['a', 'b', 'c'],
	roundScores: [{ round: 1, label: 'Hand 1', scores: [] }],
	gameSpecific: { bids: { a: 1 } },
	lastUpdate: 100
};

const played: GameDocument = {
	...base,
	moves: [...base.moves, { playerId: 'c', card: { suit: 'spades', rank: 12 }, timestamp: 12 }],
	lastUpdate: 101
};

describe('diffDoc', () => {
	it('carries only appended moves and changed fields', () => {
		const delta = diffDoc(base, played);

		expect(delta).toEqual({
			roomId: 'room-1',
			baseRound: 2,
			baseMoveCount: 2,
			baseLastUpdate: 100,
			moves: [{ playerId: 'c', card: { suit: 'spades', rank: 12 }, timestamp: 12 }],
			fields: { lastUpdate: 101 }
		});
	});

	it('includes changed non-move fields with their full new value', () => {
		const next = { ...base, phase: 'bidding', gameSpecific: { bids: { a: 1, b: 0 } }, lastUpdate: 101 };

		expect(diffDoc(base, next)?.fields).toEqual({
			phase: 'bidding',
			gameSpecific: { bids: { a: 1, b: 0 } },
			lastUpdate: 101
		});
	});

	it.each([
		['there is no previous doc', null, played],
		['a field was removed', base, (({ gameSpecific: _omit, ...rest }) => rest)(played) as GameDocument],
		['the round changed', base, { ...played, currentRound: 3 }],
		['the room changed', base, { ...played, roomId: 'room-2' }],
		['moves were removed', played, base],
		['an earlier move was rewritten', base, { ...played, moves: [played.moves[1], played.moves[0], played.moves[2]] }]
	])('returns null when %s', (_label, prev, next) => {
		expect(diffDoc(prev, next)).toBeNull();
	});
});

describe('isDeltaStale', () => {
	it.each([
		['the receiver already applied it (duplicate or echo)', played, true],
		['the receiver moved to a later round', { ...base, currentRound: 3, moves: [], lastUpdate: 150 }, true],
		['the receiver is behind the base', { ...base, moves: base.moves.slice(0, 1), lastUpdate: 90 }, false],
		['the receiver is exactly at the base', base, false],
		['the receiver has no doc', null, false]
	])('%s -> %p', (_label, current, expected) => {
		expect(isDeltaStale(current, diffDoc(base, played)!)).toBe(expected);
	});
});

describe('applyDocDelta', () => {
	it('rebuilds the exact next doc from the base doc', () => {
		const delta = diffDoc(base, played)!;

		expect(applyDocDelta(base, delta)).toEqual(played);
	});

	it.each([
		['the receiver has no doc', null],
		['the receiver is on another round', { ...base, currentRound: 1 }],
		['the receiver has a different move count', played],
		['the receiver has a different version', { ...base, lastUpdate: 99 }],
		['the receiver is in another room', { ...base, roomId: 'room-9' }]
	])('returns null when %s', (_label, current) => {
		const delta = diffDoc(base, played)!;

		expect(applyDocDelta(current, delta)).toBeNull();
	});

	it('is much smaller than the full doc late in a hand', () => {
		const longHand: GameDocument = {
			...base,
			moves: Array.from({ length: 40 }, (_, i) => ({
				playerId: `p${i % 4}`,
				card: { suit: 'clubs' as const, rank: 2 + (i % 13) },
				timestamp: 1000 + i
			}))
		};
		const next = { ...longHand, moves: [...longHand.moves, played.moves[2]], lastUpdate: 101 };

		const deltaSize = JSON.stringify(diffDoc(longHand, next)).length;

		expect(deltaSize).toBeLessThan(JSON.stringify(next).length / 5);
	});
});

describe('local P2P sync publishing', () => {
	it('sends the first doc in full, then follow-up moves as deltas, and a new round in full', async () => {
		const sent: { type: string }[] = [];
		const sync = createLocalP2pSync(() => ({ broadcast: (msg) => sent.push(msg as { type: string }) }));
		const nextRound = { ...played, currentRound: 3, moves: [], lastUpdate: 102 };

		await sync.publish('room-1', base);
		await sync.publish('room-1', played);
		await sync.publish('room-1', nextRound);

		expect(sent).toEqual([
			{ type: 'sync_doc', roomId: 'room-1', doc: base },
			{ type: 'doc_delta', delta: diffDoc(base, played) },
			{ type: 'sync_doc', roomId: 'room-1', doc: nextRound }
		] as never);
	});
});
