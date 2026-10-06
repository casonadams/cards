import type { GameRoom, RoomPlayer, Player } from '../types/index.ts';
import type { GameRoomRepository } from '../ports/index.ts';
import { generateRoomCode } from './room-code.ts';

export interface CreateRoomParams {
	host: Player;
	gameDefinitionId: string;
	maxPlayers: number;
}

function toRoomPlayer(player: Player, isHost: boolean): RoomPlayer {
	return { ...player, isHost, isConnected: true, lastSeen: Date.now() };
}

export async function createRoom(
	repo: GameRoomRepository,
	params: CreateRoomParams
): Promise<GameRoom> {
	const code = generateRoomCode();
	const players = [toRoomPlayer(params.host, true)];
	return repo.create({
		code,
		hostId: params.host.id,
		gameDefinitionId: params.gameDefinitionId,
		maxPlayers: params.maxPlayers,
		players,
		playerIds: players.map((p) => p.id),
		phase: 'lobby',
		createdAt: Date.now()
	});
}

export interface JoinRoomResult {
	readonly success: boolean;
	readonly error?: string;
	readonly room?: GameRoom;
}

export interface JoinRoomParams {
	readonly repo: GameRoomRepository;
	readonly code: string;
	readonly player: Player;
}

function validateRoomState(room: GameRoom): string | null {
	if (room.phase !== 'lobby') return 'Game already in progress';
	return null;
}

function validateRoomCapacity(room: GameRoom, playerId: string): string | null {
	const isAlreadyIn = room.players.some((p) => p.id === playerId);
	if (!isAlreadyIn && room.players.length >= room.maxPlayers) return 'Room is full';
	return null;
}

function validateJoin(room: GameRoom | null, playerId: string): string | null {
	if (!room) return 'Room not found';
	return validateRoomState(room) ?? validateRoomCapacity(room, playerId);
}

export async function joinRoom(params: JoinRoomParams): Promise<JoinRoomResult> {
	const { repo, code, player } = params;
	const room = await repo.getByCode(code);
	const error = validateJoin(room, player.id);
	if (error) return { success: false, error };

	const alreadyIn = room!.players.some((p) => p.id === player.id);
	if (alreadyIn) return { success: true, room: room! };

	const newPlayers = [...room!.players, toRoomPlayer(player, false)];
	const updated: GameRoom = {
		...room!,
		players: newPlayers,
		playerIds: newPlayers.map((p) => p.id)
	};
	await repo.update(room!.id, { players: updated.players, playerIds: updated.playerIds });
	return { success: true, room: updated };
}
