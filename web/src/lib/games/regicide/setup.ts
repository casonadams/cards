import { shuffle } from '$lib/platform/engine/index';
import { createDeck } from '$lib/platform/engine/index';
import { HAND_SIZES } from './types.ts';
import type { Card } from '$lib/platform/types/index';

function isFaceCard(card: Card): boolean {
	return card.rank >= 11 && card.rank <= 13;
}

function buildCastle(seed: number): readonly Card[] {
	const deck = createDeck();
	const jacks = deck.filter((c) => c.rank === 11);
	const queens = deck.filter((c) => c.rank === 12);
	const kings = deck.filter((c) => c.rank === 13);
	return [...shuffle(jacks, seed), ...shuffle(queens, seed + 1), ...shuffle(kings, seed + 2)];
}

function buildTavern(seed: number): readonly Card[] {
	const deck = createDeck();
	return shuffle(
		deck.filter((c) => !isFaceCard(c)),
		seed + 3
	);
}

export interface RegicideSetupResult {
	readonly castle: readonly Card[];
	readonly hands: readonly (readonly Card[])[];
	readonly tavern: readonly Card[];
}

export function setupRegicide(playerCount: number, seed: number): RegicideSetupResult {
	const castle = buildCastle(seed);
	const tavernFull = buildTavern(seed);
	const handSize = HAND_SIZES[playerCount] ?? 5;
	const hands: Card[][] = Array.from({ length: playerCount }, () => []);
	let dealt = 0;
	for (let i = 0; i < playerCount * handSize; i++) {
		hands[i % playerCount].push(tavernFull[dealt++]);
	}
	const tavern = tavernFull.slice(dealt);
	return { castle, hands, tavern };
}
