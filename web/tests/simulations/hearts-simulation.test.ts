import { describe, expect, it } from 'bun:test';
import { heartsRuntime } from '$lib/games/hearts/runtime';
import { runSimulationSuite, simulateMatch } from './runner.ts';

describe('Hearts Headless Simulation Harness', () => {
	it('executes a single deterministic Hearts match without error', () => {
		const match = simulateMatch(heartsRuntime, 42, {
			playerCount: 4,
			slaMs: 300,
			maxRounds: 5
		});
		expect(match.completed).toBe(true);
		expect(match.totalMoves).toBeGreaterThan(0);
		expect(match.latencies.length).toBe(match.totalMoves);
		for (const lat of match.latencies) {
			expect(lat).toBeLessThanOrEqual(300);
		}
	});

	it('simulates 1,000 randomized seeds with 100% completion and 0 exceptions', () => {
		const metrics = runSimulationSuite({
			runtime: heartsRuntime,
			seedStart: 1,
			seedEnd: 1000,
			playerCount: 4,
			slaMs: 300,
			maxRounds: 1 // 1 full round (13 tricks = 52 moves) per seed across 1,000 seeds = 52,000 moves
		});

		expect(metrics.totalSeeds).toBe(1000);
		expect(metrics.completedSeeds).toBe(1000);
		expect(metrics.unhandledExceptions).toBe(0);
		expect(metrics.legalMoveViolations).toBe(0);
		expect(metrics.totalMoves).toBe(52000); // 52 moves per round * 1000 seeds
		expect(metrics.maxLatencyMs).toBeLessThanOrEqual(300);

		console.log(
			`[Hearts 1,000 Seeds] Moves: ${metrics.totalMoves}, Max Latency: ${metrics.maxLatencyMs.toFixed(3)}ms, Avg: ${metrics.avgLatencyMs.toFixed(3)}ms, P95: ${metrics.p95LatencyMs.toFixed(3)}ms`
		);
	}, 30000);
});
