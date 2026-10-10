import { describe, expect, it } from 'bun:test';
import { wizardRuntime } from '$lib/games/wizard/runtime';
import { runSimulationSuite, simulateMatch } from './runner.ts';

describe('Wizard Headless Simulation Harness', () => {
	it('executes a single deterministic Wizard match without error', () => {
		const match = simulateMatch(wizardRuntime, 42, {
			playerCount: 4,
			slaMs: 300,
			maxRounds: 3
		});
		expect(match.completed).toBe(true);
		expect(match.totalMoves).toBeGreaterThan(0);
		for (const lat of match.latencies) {
			expect(lat).toBeLessThanOrEqual(300);
		}
	});

	it('simulates 1,000 randomized seeds with 100% completion and 0 exceptions', () => {
		const metrics = runSimulationSuite({
			runtime: wizardRuntime,
			seedStart: 1,
			seedEnd: 1000,
			playerCount: 4,
			slaMs: 300,
			maxRounds: 2 // 2 progressive rounds (1 card + 2 cards = 3 tricks * 4 players = 12 moves) * 1000 = 12,000 moves
		});

		expect(metrics.totalSeeds).toBe(1000);
		expect(metrics.completedSeeds).toBe(1000);
		expect(metrics.unhandledExceptions).toBe(0);
		expect(metrics.legalMoveViolations).toBe(0);
		expect(metrics.totalMoves).toBe(12000);
		expect(metrics.maxLatencyMs).toBeLessThanOrEqual(300);

		console.log(
			`[Wizard 1,000 Seeds] Moves: ${metrics.totalMoves}, Max Latency: ${metrics.maxLatencyMs.toFixed(3)}ms, Avg: ${metrics.avgLatencyMs.toFixed(3)}ms, P95: ${metrics.p95LatencyMs.toFixed(3)}ms`
		);
	}, 30000);
});
