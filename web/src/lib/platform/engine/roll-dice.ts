import type { DiceConfig, DiceResult } from '../types/index.ts';
import { createSeededRandom } from './seeded-random.ts';

export function rollDice(config: DiceConfig, seed?: number): DiceResult {
	const rng = seed !== undefined ? createSeededRandom(seed) : undefined;

	return Array.from({ length: config.count }, () => {
		const rand = rng ? rng.next() : Math.random();
		return Math.floor(rand * config.sides) + 1;
	});
}
