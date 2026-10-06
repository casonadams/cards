import type { Player } from '../types/index.ts';

export interface AuthService {
	signInWithGoogle(): Promise<Player>;
	signInWithEmail(email: string, password: string): Promise<Player>;
	signUpWithEmail(params: {
		email: string;
		password: string;
		displayName: string;
	}): Promise<Player>;
	signOut(): Promise<void>;
	getCurrentPlayer(): Player | null;
	onAuthStateChanged(callback: (player: Player | null) => void): () => void;
}
