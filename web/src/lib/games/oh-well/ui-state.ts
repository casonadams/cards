import type { Suit, Card } from '$lib/platform/types/index';
import type { OhWellPhase, PlayerBid } from './types.ts';

export interface OhWellUiState {
	readonly phase: OhWellPhase;
	readonly trumpSuit: Suit | null;
	readonly trumpCard: Card | null;
	readonly bids: readonly PlayerBid[];
	readonly cardsPerPlayer: number;
	readonly canBid: boolean;
	readonly hookBid: number | null;
	readonly tricksTaken: Record<string, number>;
	readonly leaderId: string;
	readonly dealerId: string;
}
