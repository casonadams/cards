import type { GameState } from './engine.ts';

function isNonNullObject(val: unknown): val is Record<string, unknown> {
	return val !== null && typeof val === 'object';
}

export function ensureArray(val: unknown): unknown[] {
	if (Array.isArray(val)) return val;
	return isNonNullObject(val) ? Object.values(val) : [];
}

function parseArrayFields(
	raw: Record<string, unknown>
): Pick<
	GameState,
	'castle' | 'tavern' | 'discard' | 'hands' | 'lastPlayedCards' | 'lastSuitPowers'
> {
	return {
		castle: ensureArray(raw.castle) as GameState['castle'],
		hands: ensureArray(raw.hands).map((h) => ensureArray(h)) as GameState['hands'],
		tavern: ensureArray(raw.tavern) as GameState['tavern'],
		discard: ensureArray(raw.discard) as GameState['discard'],
		lastPlayedCards: ensureArray(raw.lastPlayedCards) as GameState['lastPlayedCards'],
		lastSuitPowers: ensureArray(raw.lastSuitPowers) as GameState['lastSuitPowers']
	};
}

function numericField(params: {
	raw: Record<string, unknown>;
	key: string;
	fallback: number;
}): number {
	return (params.raw[params.key] as number) ?? params.fallback;
}

function parsePlayerFields(
	raw: Record<string, unknown>,
	playerCount: number
): Pick<GameState, 'currentPlayer' | 'defenseNeeded' | 'defendingPlayer' | 'playerCount'> {
	return {
		currentPlayer: numericField({ raw, key: 'currentPlayer', fallback: 0 }),
		defenseNeeded: numericField({ raw, key: 'defenseNeeded', fallback: 0 }),
		defendingPlayer: numericField({ raw, key: 'defendingPlayer', fallback: 0 }),
		playerCount: numericField({ raw, key: 'playerCount', fallback: playerCount })
	};
}

function parsePhaseFields(raw: Record<string, unknown>): Pick<GameState, 'currentEnemy' | 'phase'> {
	return {
		currentEnemy: raw.currentEnemy as GameState['currentEnemy'],
		phase: (raw.phase as GameState['phase']) ?? 'play'
	};
}

export function parseGameState(gameSpecific: unknown, playerCount: number): GameState | null {
	if (!isNonNullObject(gameSpecific)) return null;
	return {
		...parseArrayFields(gameSpecific),
		...parsePlayerFields(gameSpecific, playerCount),
		...parsePhaseFields(gameSpecific)
	};
}
