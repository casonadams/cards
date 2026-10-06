const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export function generateRoomCode(): string {
	return Array.from(
		{ length: CODE_LENGTH },
		() => CHARS[Math.floor(Math.random() * CHARS.length)]
	).join('');
}
