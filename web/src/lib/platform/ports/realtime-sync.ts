export interface RealtimeSync<T> {
	subscribe(roomId: string, callback: (state: T) => void): () => void;
	publish(roomId: string, state: T, broadcast?: boolean): Promise<void>;
	appendMove(roomId: string, move: unknown): Promise<void>;
	remove(roomId: string): Promise<void>;
}
