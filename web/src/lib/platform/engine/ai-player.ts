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
