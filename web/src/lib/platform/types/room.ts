import type { RoomPlayer } from './player.ts';

export type RoomPhase = 'lobby' | 'setup' | 'playing' | 'paused' | 'roundScoring' | 'gameOver';

export interface GameRoom {
	readonly id: string;
	readonly code: string;
	readonly hostId: string;
	readonly tempHostId?: string;
	readonly hostDisconnectedAt?: number;
	readonly gameDefinitionId: string;
	readonly maxPlayers: number;
	readonly players: readonly RoomPlayer[];
	readonly playerIds: readonly string[];
	readonly phase: RoomPhase;
	readonly createdAt: number;
}
