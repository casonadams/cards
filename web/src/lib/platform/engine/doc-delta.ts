import type { GameDocument, Move } from './game-sync.ts';

type DeltaFields = Partial<Omit<GameDocument, 'roomId' | 'moves'>>;

export interface DocDelta {
	readonly roomId: string;
	readonly baseRound: number;
	readonly baseMoveCount: number;
	readonly baseLastUpdate: number;
	readonly moves: readonly Move[];
	readonly fields: DeltaFields;
}

function moveKey(move: Move | undefined): string {
	return move ? `${move.playerId}:${move.card?.suit}:${move.card?.rank}:${move.timestamp}` : '';
}

function extendsMoves(prev: readonly Move[], next: readonly Move[]): boolean {
	if (next.length < prev.length) return false;
	return prev.every((move, i) => moveKey(move) === moveKey(next[i]));
}

function changedFields(prev: GameDocument, next: GameDocument): DeltaFields | null {
	const fields: Record<string, unknown> = {};
	for (const key of Object.keys(prev) as (keyof GameDocument)[]) {
		if (!(key in next)) return null;
	}
	for (const key of Object.keys(next) as (keyof GameDocument)[]) {
		if (key === 'roomId' || key === 'moves') continue;
		if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) {
			fields[key] = next[key];
		}
	}
	return fields as DeltaFields;
}

export function diffDoc(prev: GameDocument | null, next: GameDocument): DocDelta | null {
	if (!prev || prev.roomId !== next.roomId || prev.currentRound !== next.currentRound) return null;
	if (!extendsMoves(prev.moves, next.moves)) return null;
	const fields = changedFields(prev, next);
	if (!fields) return null;
	return {
		roomId: next.roomId,
		baseRound: prev.currentRound,
		baseMoveCount: prev.moves.length,
		baseLastUpdate: prev.lastUpdate,
		moves: next.moves.slice(prev.moves.length),
		fields
	};
}

export function isDeltaStale(current: GameDocument | null, delta: DocDelta): boolean {
	if (!current || current.roomId !== delta.roomId) return false;
	if (current.currentRound !== delta.baseRound) return current.currentRound > delta.baseRound;
	const targetLastUpdate = delta.fields.lastUpdate ?? delta.baseLastUpdate;
	return (
		current.moves.length >= delta.baseMoveCount + delta.moves.length &&
		current.lastUpdate >= targetLastUpdate
	);
}

export function applyDocDelta(current: GameDocument | null, delta: DocDelta): GameDocument | null {
	if (
		!current ||
		current.roomId !== delta.roomId ||
		current.currentRound !== delta.baseRound ||
		current.moves.length !== delta.baseMoveCount ||
		current.lastUpdate !== delta.baseLastUpdate
	) {
		return null;
	}
	return { ...current, ...delta.fields, moves: [...current.moves, ...delta.moves] };
}
