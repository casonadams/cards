import type { ScoreEntry } from '../types/index.ts';
import type { RoomPlayer } from '../types/index.ts';

export interface GameMachineContext {
	players: RoomPlayer[];
	currentRound: number;
	totalRounds: number;
	scores: ScoreEntry[];
	gameState: unknown;
	disconnectedPlayerId: string | null;
}

export type GameMachineEvent =
	| { type: 'START_GAME'; totalRounds: number }
	| { type: 'SETUP_COMPLETE'; gameState: unknown }
	| { type: 'ROUND_COMPLETE'; scores: ScoreEntry[]; isGameOver: boolean }
	| { type: 'NEXT_ROUND' }
	| { type: 'PLAYER_DISCONNECTED'; playerId: string }
	| { type: 'PLAYER_RECONNECTED' }
	| { type: 'TIMEOUT' }
	| { type: 'RETURN_TO_LOBBY' };
