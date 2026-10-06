import type { UserProfile } from '../types/index.ts';

export interface UserProfileRepository {
	create(profile: UserProfile): Promise<void>;
	getById(id: string): Promise<UserProfile | null>;
	isAllowedToPlay(id: string): Promise<boolean>;
	onProfileChanged(id: string, callback: (profile: UserProfile | null) => void): () => void;
	listAll(): Promise<UserProfile[]>;
	update(id: string, data: Partial<UserProfile>): Promise<void>;
}
