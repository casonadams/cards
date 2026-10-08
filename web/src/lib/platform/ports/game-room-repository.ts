import type { GameRoom } from '../types/index.ts';

export interface GameRoomRepository {
	create(room: Omit<GameRoom, 'id'>): Promise<GameRoom>;
	getById(id: string): Promise<GameRoom | null>;
	getByCode(code: string): Promise<GameRoom | null>;
	update(id: string, data: Partial<GameRoom>, broadcast?: boolean): Promise<void>;
	delete(id: string): Promise<void>;
	onRoomChanged(id: string, callback: (room: GameRoom | null) => void): () => void;
	deleteStaleRooms(maxAgeMs: number): Promise<number>;
}
