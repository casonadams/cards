import { describe, expect, it } from 'bun:test';
import { ginRummyRuntime } from '$lib/games/gin-rummy/runtime';
import { runSimulationSuite, simulateMatch } from './runner.ts';

describe('Gin Rummy Headless Simulation Harness', () => {
	it('executes a single deterministic Gin Rummy match without error', () => {
		const match = simulateMatch(ginRummyRuntime, 42, {
			playerCount: 2,
			slaMs: 300,
			maxRounds: 1,
			maxStepsPerRound: 100
		});
		expect(match.completed).toBe(true);
		expect(match.totalMoves).toBeGreaterThan(0);
		for (const lat of match.latencies) {
			expect(lat).toBeLessThanOrEqual(300);
		}
	});

	it('simulates 1,000 randomized seeds with 100% completion and 0 exceptions', () => {
		const metrics = runSimulationSuite({
			runtime: ginRummyRuntime,
			seedStart: 1,
			seedEnd: 1000,
			playerCount: 2,
			slaMs: 300,
			maxRounds: 1
		});

		expect(metrics.totalSeeds).toBe(1000);
		expect(metrics.completedSeeds).toBe(1000);
		expect(metrics.unhandledExceptions).toBe(0);
		expect(metrics.legalMoveViolations).toBe(0);
		expect(metrics.totalMoves).toBeGreaterThan(1000);
		expect(metrics.maxLatencyMs).toBeLessThanOrEqual(300);

		console.log(
			`[Gin Rummy 1,000 Seeds] Moves: ${metrics.totalMoves}, Max Latency: ${metrics.maxLatencyMs.toFixed(3)}ms, Avg: ${metrics.avgLatencyMs.toFixed(3)}ms, P95: ${metrics.p95LatencyMs.toFixed(3)}ms`
		);
	}, 30000);
});
