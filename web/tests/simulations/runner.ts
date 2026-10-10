import { expect } from 'bun:test';
import type { GameRuntime, Move } from '$lib/platform/types/index';

export interface SimulationOptions {
	readonly runtime: GameRuntime;
	readonly seedStart?: number;
	readonly seedEnd?: number;
	readonly seeds?: readonly number[];
	readonly playerCount?: number;
	readonly slaMs?: number;
	readonly maxRounds?: number;
	readonly maxStepsPerRound?: number;
}

export interface SimulationMetrics {
	readonly gameId: string;
	readonly totalSeeds: number;
	readonly completedSeeds: number;
	readonly totalMoves: number;
	readonly maxLatencyMs: number;
	readonly avgLatencyMs: number;
	readonly p95LatencyMs: number;
	readonly legalMoveViolations: number;
	readonly unhandledExceptions: number;
}

/**
 * Executes a deterministic headless simulation match for a single seed.
 */
export function simulateMatch(
	runtime: GameRuntime,
	seed: number,
	options: {
		playerCount?: number;
		slaMs?: number;
		maxRounds?: number;
		maxStepsPerRound?: number;
	} = {}
): {
	totalMoves: number;
	roundsPlayed: number;
	latencies: number[];
	completed: boolean;
	gameOver: boolean;
} {
	const playerCount = options.playerCount ?? runtime.minPlayers;
	const slaMs = options.slaMs ?? 300;
	const maxRounds = options.maxRounds ?? 50;
	const maxStepsPerRound = options.maxStepsPerRound ?? 250;

	const playerIds = Array.from({ length: playerCount }, (_, i) => `player-${i}`);
	const latencies: number[] = [];

	let currentRound = 0;
	let dealerIndex = 0;
	let gameSpecific: unknown = undefined;
	let totalMoves = 0;
	let gameOver = false;

	while (currentRound < maxRounds && !gameOver) {
		let moves: Move[] = [];
		let roundSteps = 0;
		gameSpecific = undefined;

		while (roundSteps < maxStepsPerRound) {
			// Query state from observer/dealer perspective first to identify turn
			const state = runtime.deriveState({
				moves,
				seed,
				currentRound,
				playerCount,
				playerIds,
				myId: playerIds[0],
				dealerIndex,
				gameSpecific
			});

			if (state.gameSpecific !== undefined) {
				gameSpecific = state.gameSpecific;
			}

			if (state.isGameOver) {
				gameOver = true;
				break;
			}

			if (state.isRoundComplete) {
				break;
			}

			const turnIdx = state.currentTurnIndex;
			expect(turnIdx).toBeGreaterThanOrEqual(0);
			expect(turnIdx).toBeLessThan(playerCount);

			const turnPlayerId = playerIds[turnIdx];

			// Query turn player's state for legal move validation
			const turnState = runtime.deriveState({
				moves,
				seed,
				currentRound,
				playerCount,
				playerIds,
				myId: turnPlayerId,
				dealerIndex,
				gameSpecific
			});

			// Monotonic high-resolution timer for bot latency SLA
			const t0 = performance.now();
			const aiResult = runtime.computeAiMove({
				moves,
				seed,
				currentRound,
				playerCount,
				playerIds,
				aiPlayerId: turnPlayerId,
				dealerIndex,
				gameSpecific: turnState.gameSpecific ?? gameSpecific
			});
			const latency = performance.now() - t0;
			latencies.push(latency);

			// Assert bot SLA <= 300ms
			expect(latency).toBeLessThanOrEqual(slaMs);

			// Assert bot produced a move
			expect(aiResult).not.toBeNull();
			if (!aiResult) {
				throw new Error(`AI returned null move for ${turnPlayerId} in ${runtime.id} on step ${roundSteps}`);
			}
			expect(aiResult.playerId).toBe(turnPlayerId);

			// Assert legal play within rules: if playableCards is specified, card must be legal
			if (turnState.playableCards && turnState.playableCards.length > 0) {
				const isLegal = turnState.playableCards.some(
					(c) => c.suit === aiResult.card.suit && c.rank === aiResult.card.rank
				);
				if (!isLegal) {
					throw new Error(
						`Illegal move submitted by ${turnPlayerId}: ${aiResult.card.rank} of ${aiResult.card.suit} not in playable cards [${turnState.playableCards.map((c) => `${c.rank} of ${c.suit}`).join(', ')}]`
					);
				}
			}

			const move: Move = {
				playerId: aiResult.playerId,
				card: aiResult.card,
				timestamp: Date.now()
			};

			moves.push(move);
			totalMoves++;
			roundSteps++;
		}

		currentRound++;
		dealerIndex = (dealerIndex + 1) % playerCount;
	}

	return {
		totalMoves,
		roundsPlayed: currentRound,
		latencies,
		completed: true,
		gameOver
	};
}

/**
 * Runs a deterministic simulation across a range of seeds and collects summary metrics.
 */
export function runSimulationSuite(options: SimulationOptions): SimulationMetrics {
	const { runtime } = options;
	const seeds =
		options.seeds ??
		Array.from(
			{ length: (options.seedEnd ?? 1000) - (options.seedStart ?? 1) + 1 },
			(_, i) => (options.seedStart ?? 1) + i
		);

	let completedSeeds = 0;
	let totalMoves = 0;
	let maxLatencyMs = 0;
	let totalLatencyMs = 0;
	let allLatencies: number[] = [];
	let legalMoveViolations = 0;
	let unhandledExceptions = 0;

	for (const seed of seeds) {
		try {
			const res = simulateMatch(runtime, seed, {
				playerCount: options.playerCount,
				slaMs: options.slaMs,
				maxRounds: options.maxRounds,
				maxStepsPerRound: options.maxStepsPerRound
			});

			if (res.completed) {
				completedSeeds++;
				totalMoves += res.totalMoves;
				for (const lat of res.latencies) {
					allLatencies.push(lat);
					if (lat > maxLatencyMs) maxLatencyMs = lat;
					totalLatencyMs += lat;
				}
			}
		} catch (err) {
			unhandledExceptions++;
			throw err;
		}
	}

	allLatencies.sort((a, b) => a - b);
	const p95Idx = Math.floor(allLatencies.length * 0.95);
	const p95LatencyMs = allLatencies[p95Idx] ?? 0;
	const avgLatencyMs = allLatencies.length > 0 ? totalLatencyMs / allLatencies.length : 0;

	return {
		gameId: runtime.id,
		totalSeeds: seeds.length,
		completedSeeds,
		totalMoves,
		maxLatencyMs,
		avgLatencyMs,
		p95LatencyMs,
		legalMoveViolations,
		unhandledExceptions
	};
}
