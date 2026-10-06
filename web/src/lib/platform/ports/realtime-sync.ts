export interface RealtimeSync<T> {
	subscribe(roomId: string, callback: (state: T) => void): () => void;
	publish(roomId: string, state: T): Promise<void>;
	appendMove(roomId: string, move: unknown): Promise<void>;
	remove(roomId: string): Promise<void>;
}
