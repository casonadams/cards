export interface Player {
	readonly id: string;
	readonly displayName: string;
	readonly avatarUrl?: string;
}

export interface UserProfile extends Player {
	readonly email: string;
	readonly allowedToPlay: boolean;
	readonly isAdmin: boolean;
	readonly createdAt: number;
}

export interface RoomPlayer extends Player {
	readonly isHost: boolean;
	readonly isConnected: boolean;
	readonly lastSeen: number;
	readonly isAiControlled?: boolean;
}

