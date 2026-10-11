import { describe, expect, it } from 'bun:test';
import { recordPlayedCardPosition, getLastPlayedCardPosition } from '$lib/utils.ts';

describe('card animation position tracking', () => {
	it('records and retrieves position for matching cardKey', () => {
		const fakeEl = {
			getBoundingClientRect: () => ({
				left: 100,
				width: 80,
				top: 500,
				height: 120,
				right: 180,
				bottom: 620,
				x: 100,
				y: 500,
				toJSON: () => {}
			})
		} as unknown as HTMLElement;

		recordPlayedCardPosition(fakeEl, 'hearts-14');

		// Non-matching card key must NOT steal the position or clear it
		expect(getLastPlayedCardPosition('spades-10')).toBeNull();

		// Matching card key consumes the position
		const pos = getLastPlayedCardPosition('hearts-14');
		expect(pos).toEqual({ x: 140, y: 560 });

		// Once consumed, subsequent calls return null
		expect(getLastPlayedCardPosition('hearts-14')).toBeNull();
	});

	it('returns null when no position was recorded', () => {
		expect(getLastPlayedCardPosition('clubs-7')).toBeNull();
	});
});
