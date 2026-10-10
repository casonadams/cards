import { describe, expect, it } from 'bun:test';
import { euchreRuntime } from '$lib/games/euchre/runtime';
import { runSimulationSuite, simulateMatch } from './runner.ts';

describe('Euchre Headless Simulation Harness', () => {
	it('executes a single deterministic Euchre match without error', () => {
		const match = simulateMatch(euchreRuntime, 42, {
			playerCount: 4,
			slaMs: 300,
			maxRounds: 1
		});
		expect(match.completed).toBe(true);
		expect(match.totalMoves).toBe(20); // 5 tricks * 4 players = 20 moves
		for (const lat of match.latencies) {
			expect(lat).toBeLessThanOrEqual(300);
		}
	});

	it('simulates 1,000 randomized seeds with 100% completion and 0 exceptions', () => {
		const metrics = runSimulationSuite({
			runtime: euchreRuntime,
			seedStart: 1,
			seedEnd: 1000,
			playerCount: 4,
			slaMs: 300,
			maxRounds: 1
		});

		expect(metrics.totalSeeds).toBe(1000);
		expect(metrics.completedSeeds).toBe(1000);
		expect(metrics.unhandledExceptions).toBe(0);
		expect(metrics.legalMoveViolations).toBe(0);
		expect(metrics.totalMoves).toBe(20000); // 20 moves * 1000 seeds
		expect(metrics.maxLatencyMs).toBeLessThanOrEqual(300);

		console.log(
			`[Euchre 1,000 Seeds] Moves: ${metrics.totalMoves}, Max Latency: ${metrics.maxLatencyMs.toFixed(3)}ms, Avg: ${metrics.avgLatencyMs.toFixed(3)}ms, P95: ${metrics.p95LatencyMs.toFixed(3)}ms`
		);
	}, 30000);
});
