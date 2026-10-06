import type { Card, Hand } from '../types/index.ts';
import { validatePlay } from './trick.ts';

const AI_NAMES = ['Bot Alice', 'Bot Bob', 'Bot Carol', 'Bot Dave', 'Bot Eve'];

export function createAiPlayerId(index: number): string {
	return `ai-${index}`;
}

export function isAiPlayer(playerId: string): boolean {
	return playerId.startsWith('ai-');
}

export function getAiDisplayName(index: number): string {
	return AI_NAMES[index % AI_NAMES.length];
}

export function pickAiCard(hand: Hand, ledSuit: string | null): Card {
	const validCards = hand.filter((c) => validatePlay({ hand, card: c, ledSuit }).valid);
	const choices = validCards.length > 0 ? validCards : hand;
	return choices[Math.floor(Math.random() * choices.length)];
}
