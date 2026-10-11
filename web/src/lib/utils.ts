import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function getInitials(name: string): string {
	const parts = name.trim().split(/\s+/);
	if (parts.length >= 2) {
		return (parts[0][0] + parts[1][0]).toUpperCase();
	}
	return name.slice(0, 2).toUpperCase();
}

export function getFirstName(name: string): string {
	const trimmed = name.trim();
	if (trimmed.startsWith('Bot ') && trimmed.length > 4) {
		return trimmed;
	}
	const spaceIdx = trimmed.indexOf(' ');
	if (spaceIdx > 0) {
		return trimmed.slice(0, spaceIdx);
	}
	return trimmed;
}

interface RecordedCardPosition {
	cardKey?: string;
	x: number;
	y: number;
}

let lastPlayedCardCoords: RecordedCardPosition | null = null;

export function recordPlayedCardPosition(el: HTMLElement | null, cardKey?: string): void {
	if (!el) return;
	const r = el.getBoundingClientRect();
	lastPlayedCardCoords = {
		cardKey,
		x: Math.round(r.left + r.width / 2),
		y: Math.round(r.top + r.height / 2)
	};
}

export function getLastPlayedCardPosition(cardKey?: string): { x: number; y: number } | null {
	if (!lastPlayedCardCoords) return null;
	if (cardKey && lastPlayedCardCoords.cardKey && lastPlayedCardCoords.cardKey !== cardKey) {
		return null;
	}
	const pos = { x: lastPlayedCardCoords.x, y: lastPlayedCardCoords.y };
	lastPlayedCardCoords = null;
	return pos;
}
