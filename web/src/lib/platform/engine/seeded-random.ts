export interface SeededRandom {
	next(): number;
}

export function createSeededRandom(seed: number): SeededRandom {
	let state = seed;
	return {
		next(): number {
			state = (state * 1664525 + 1013904223) & 0xffffffff;
			return (state >>> 0) / 0xffffffff;
		}
	};
}
