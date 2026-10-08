import { describe, expect, it } from 'bun:test';
import { shouldRunAi, scheduleAiMove } from '$lib/room/room-ai-helpers.ts';
import type { GameDocument } from '$lib/platform/engine/index.ts';
import type { DerivedGameState } from '$lib/platform/stores/game-store.ts';
import type { GameRuntime } from '$lib/platform/types/index.ts';

describe('room ai helpers', () => {
	it('shouldRunAi returns true only when host, doc, and active gs exist', () => {
		expect(shouldRunAi({ isHost: false, gameDoc: null, gs: null })).toBe(false);
		expect(
			shouldRunAi({
				isHost: true,
				gameDoc: {} as GameDocument,
				gs: { isRoundComplete: true } as DerivedGameState
			})
		).toBe(false);
		expect(
			shouldRunAi({
				isHost: true,
				gameDoc: {} as GameDocument,
				gs: { isRoundComplete: false } as DerivedGameState
			})
		).toBe(true);
	});

	it('scheduleAiMove returns undefined if current player is not an AI', () => {
		const cleanup = scheduleAiMove({
			playerIds: ['human-1', 'human-2'],
			gs: { isRoundComplete: false, currentTurnIndex: 0 } as unknown as DerivedGameState,
			gameDoc: {} as GameDocument,
			runtime: {} as GameRuntime,
			playCard: async () => {}
		});
		expect(cleanup).toBeUndefined();
	});
});
