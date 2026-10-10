import { describe, expect, it } from 'bun:test';
import { spadesRuntime } from '$lib/games/spades/runtime';
import { runSimulationSuite, simulateMatch } from './runner.ts';

describe('Spades Headless Simulation Harness', () => {
	it('executes a single deterministic Spades match (4-player) without error', () => {
		const match = simulateMatch(spadesRuntime, 42, {
			playerCount: 4,
			slaMs: 300,
			maxRounds: 1
		});
		expect(match.completed).toBe(true);
		expect(match.totalMoves).toBe(52);
		for (const lat of match.latencies) {
			expect(lat).toBeLessThanOrEqual(300);
		}
	});

	it('executes a single deterministic Spades match (6-player double-deck) without error', () => {
		const match = simulateMatch(spadesRuntime, 42, {
			playerCount: 6,
			slaMs: 300,
			maxRounds: 1
		});
		expect(match.completed).toBe(true);
		expect(match.totalMoves).toBe(102); // 17 tricks * 6 players = 102 moves
		for (const lat of match.latencies) {
			expect(lat).toBeLessThanOrEqual(300);
		}
	});

	it('simulates 1,000 randomized seeds (4-player) with 100% completion and 0 exceptions', () => {
		const metrics = runSimulationSuite({
			runtime: spadesRuntime,
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
		expect(metrics.totalMoves).toBe(52000); // 52 moves * 1000 seeds
		expect(metrics.maxLatencyMs).toBeLessThanOrEqual(300);

		console.log(
			`[Spades 4P 1,000 Seeds] Moves: ${metrics.totalMoves}, Max Latency: ${metrics.maxLatencyMs.toFixed(3)}ms, Avg: ${metrics.avgLatencyMs.toFixed(3)}ms, P95: ${metrics.p95LatencyMs.toFixed(3)}ms`
		);
	}, 30000);

	it('simulates 1,000 randomized seeds (6-player double-deck) with 100% completion and 0 exceptions', () => {
		const metrics = runSimulationSuite({
			runtime: spadesRuntime,
			seedStart: 1,
			seedEnd: 1000,
			playerCount: 6,
			slaMs: 300,
			maxRounds: 1
		});

		expect(metrics.totalSeeds).toBe(1000);
		expect(metrics.completedSeeds).toBe(1000);
		expect(metrics.unhandledExceptions).toBe(0);
		expect(metrics.legalMoveViolations).toBe(0);
		expect(metrics.totalMoves).toBe(102000); // 102 moves * 1000 seeds
		expect(metrics.maxLatencyMs).toBeLessThanOrEqual(300);

		console.log(
			`[Spades 6P Double Deck 1,000 Seeds] Moves: ${metrics.totalMoves}, Max Latency: ${metrics.maxLatencyMs.toFixed(3)}ms, Avg: ${metrics.avgLatencyMs.toFixed(3)}ms, P95: ${metrics.p95LatencyMs.toFixed(3)}ms`
		);
	}, 30000);
});
