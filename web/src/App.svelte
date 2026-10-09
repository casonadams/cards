<script lang="ts">
	import { registerAllGames } from '$lib/games/register-all';
	import { getGame, listGames, createGameSyncManager } from '$lib/platform/engine/index';
	import { generateRoomCode } from '$lib/platform/engine/room-code';
	import { createRoomActions } from '$lib/platform/stores/room-store';
	import type { GameRoom, Player, RoomPlayer, Card as CardType } from '$lib/platform/types/index';
	import type { GameDocument } from '$lib/platform/engine/index';
	import {
		createLocalP2pRoomRepo,
		createLocalP2pSync
	} from '$lib/platform/adapters/local-p2p-adapters';
	import {
		shouldAcceptDocUpdate,
		DocDedupCache
	} from '$lib/platform/engine/game-sync';
	import { P2pNetworkManager, type NetworkStatusInfo } from '$lib/platform/adapters/p2p-webrtc';
	import { isAiPlayer } from '$lib/platform/engine/ai-player';
	import {
		deriveRoomGs,
		buildPlayerNames,
		needsGameSync,
		executeSingleSkipTurn,
		shouldDestroyRoomOnHostLeave,
		shouldPruneActiveSession
	} from '$lib/room/room-helpers';
	import {
		handleStart,
		handleNextRound,
		handleAddAi
	} from '$lib/room/room-handlers';
	import {
		handlePlayCard,
		handleOhWellBidAction,
		computeAllRounds
	} from '$lib/room/game-action-handlers';
	import {
		getOhWellUiState,
		isOhWellBiddingPhase,
		getCurrentOhWellBidderId,
		computeOhWellAiBid,
		handleOhWellBid
	} from '$lib/room/oh-well-helpers';
	import {
		setupTrickTakingAi,
		setupOhWellAiBid
	} from '$lib/room/ai-effects';

	// Components
	import NavBar from '$lib/components/nav-bar.svelte';
	import RoomLobby from '$lib/components/room-lobby.svelte';
	import GameSession from '$lib/components/game-session.svelte';
	import RejoinModal, { type ActiveGameSession } from '$lib/components/rejoin-modal.svelte';
	import DisconnectionToast, { type DisconnectNotice } from '$lib/components/disconnection-toast.svelte';
	import { Button } from '$lib/components/ui/button/index';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card/index';
	import { Input } from '$lib/components/ui/input/index';
	import { getInitials } from '$lib/utils';
	import './app.css';

	registerAllGames();
	const games = listGames();

	// Persistent player profile (per-tab unique ID, global display name)
	function getOrCreatePlayerId(): string {
		if (typeof window === 'undefined') return 'player-host';
		let id = sessionStorage.getItem('cards_player_id');
		if (!id) {
			id = 'player-' + Math.random().toString(36).slice(2, 9);
			sessionStorage.setItem('cards_player_id', id);
		}
		return id;
	}
	const playerId = getOrCreatePlayerId();
	let playerName = $state(
		typeof window !== 'undefined'
			? localStorage.getItem('cards_player_name') || ''
			: ''
	);
	const hasValidName = $derived(
		playerName.trim().length > 0 && playerName.trim() !== 'Player'
	);
	let isEditingName = $state(
		typeof window !== 'undefined'
			? !localStorage.getItem('cards_player_name') || localStorage.getItem('cards_player_name') === 'Player'
			: false
	);
	let nameInput = $state(
		typeof window !== 'undefined' && localStorage.getItem('cards_player_name') !== 'Player'
			? localStorage.getItem('cards_player_name') || ''
			: ''
	);
	const myPlayer = $derived<Player>({
		id: playerId,
		displayName: playerName || 'Player'
	});

	function savePlayerName(name: string) {
		const trimmed = name.trim().slice(0, 20);
		if (trimmed.length > 0) {
			playerName = trimmed;
			nameInput = trimmed;
			if (typeof window !== 'undefined') {
				localStorage.setItem('cards_player_name', trimmed);
			}
			isEditingName = false;
			lobbyError = '';
		}
	}

	function handleNameChange(name: string) {
		savePlayerName(name);
	}

	// Platform state
	const docDedup = new DocDedupCache();
	let networkStatus = $state<NetworkStatusInfo | null>(null);
	let notices = $state<DisconnectNotice[]>([]);
	let roomId = $state('');
	let room = $state<GameRoom | null>(null);
	let gameDoc = $state<GameDocument | null>(null);
	let aiCounter = $state(1);

	const isHost = $derived(room?.hostId === myPlayer.id);
	const isTempHost = $derived(Boolean(room?.tempHostId === myPlayer.id));
	const isActingHost = $derived(isHost || isTempHost);

	let hostGraceTimer: ReturnType<typeof setInterval> | null = null;

	function startHostGraceCountdown(targetRoom: GameRoom) {
		if (hostGraceTimer) clearInterval(hostGraceTimer);
		const actingHostPlayer = targetRoom.players.find((p) => p.id === targetRoom.tempHostId);
		const hostPlayer = targetRoom.players.find((p) => p.id === targetRoom.hostId);
		const startTime = targetRoom.hostDisconnectedAt || Date.now();
		const totalWindowMs = 30000;

		function tick() {
			const elapsed = Date.now() - startTime;
			const remaining = Math.max(0, Math.ceil((totalWindowMs - elapsed) / 1000));

			if (remaining > 0) {
				const existingNotice = notices.find((n) => n.type === 'host_disconnecting');
				const noticeData: DisconnectNotice = {
					id: existingNotice?.id || 'notice-host-grace',
					playerId: targetRoom.hostId,
					playerName: hostPlayer?.displayName || 'Host',
					actingHostName: actingHostPlayer?.displayName || 'Temporary Host',
					type: 'host_disconnecting',
					remainingSeconds: remaining,
					timestamp: Date.now()
				};
				notices = [...notices.filter((n) => n.type !== 'host_disconnecting'), noticeData];
			} else {
				if (hostGraceTimer) {
					clearInterval(hostGraceTimer);
					hostGraceTimer = null;
				}
				notices = notices.filter((n) => n.type !== 'host_disconnecting');

				// If I am the temporary host, finalize permanent host promotion
				if (room && room.tempHostId === myPlayer.id) {
					const originalHostId = room.hostId;
					const promotedPlayers = room.players.map((p) => {
						if (p.id === myPlayer.id) return { ...p, isHost: true };
						if (p.id === originalHostId) return { ...p, isHost: false };
						return p;
					});
					const promotedRoom: GameRoom = {
						...room,
						hostId: myPlayer.id,
						tempHostId: undefined,
						hostDisconnectedAt: undefined,
						players: promotedPlayers
					};
					room = promotedRoom;
					roomRepo.update(promotedRoom.id, promotedRoom, true);
					p2p?.broadcast({ type: 'sync_room', room: promotedRoom });

					addNotice({
						playerId: myPlayer.id,
						playerName: myPlayer.displayName,
						type: 'reconnected'
					});
				}
			}
		}

		tick();
		hostGraceTimer = setInterval(tick, 1000);
	}

	function stopHostGraceCountdown() {
		if (hostGraceTimer) {
			clearInterval(hostGraceTimer);
			hostGraceTimer = null;
		}
		notices = notices.filter((n) => n.type !== 'host_disconnecting');
	}

	function addNotice(item: Omit<DisconnectNotice, 'id' | 'timestamp'>) {
		const id = 'notice-' + Math.random().toString(36).slice(2, 9);
		const newNotice: DisconnectNotice = {
			...item,
			id,
			timestamp: Date.now()
		};
		notices = [...notices.filter((n) => n.playerId !== item.playerId), newNotice];

		if (item.type === 'reconnected') {
			setTimeout(() => {
				dismissNotice(id);
			}, 5000);
		}
	}

	function dismissNotice(id: string) {
		notices = notices.filter((n) => n.id !== id);
	}

	let p2p: P2pNetworkManager | null = null;
	if (typeof window !== 'undefined') {
		p2p = new P2pNetworkManager({
			onStatusChange(status) {
				networkStatus = status;
				(window as any).__networkStatus = status;
			},
			onJoinRequest(code, joiningPlayer) {
				if (!isActingHost || !room) return;
				if (room.code.trim().toUpperCase() !== code.trim().toUpperCase()) return;
				const existingIndex = room.players.findIndex((p) => p.id === joiningPlayer.id);
				if (existingIndex < 0 && room.players.length >= room.maxPlayers) return;
				let updatedPlayers: RoomPlayer[];
				const wasDisconnected = existingIndex >= 0 && !room.players[existingIndex].isConnected;
				const isOriginalHostReclaiming = joiningPlayer.id === room.hostId;

				if (existingIndex >= 0) {
					updatedPlayers = [...room.players];
					updatedPlayers[existingIndex] = {
						...room.players[existingIndex],
						displayName: joiningPlayer.displayName,
						isConnected: true,
						lastSeen: Date.now(),
						isAiControlled: false,
						isHost: isOriginalHostReclaiming ? true : room.players[existingIndex].isHost
					};
				} else {
					updatedPlayers = [
						...room.players,
						{
							id: joiningPlayer.id,
							displayName: joiningPlayer.displayName,
							isHost: isOriginalHostReclaiming,
							isConnected: true,
							lastSeen: Date.now(),
							isAiControlled: false
						}
					];
				}

				let updatedTempHostId = room.tempHostId;
				let updatedHostDisconnectedAt = room.hostDisconnectedAt;
				if (isOriginalHostReclaiming) {
					updatedTempHostId = undefined;
					updatedHostDisconnectedAt = undefined;
					stopHostGraceCountdown();
				}

				const updatedRoom: GameRoom = {
					...room,
					players: updatedPlayers,
					playerIds: updatedPlayers.map((p) => p.id),
					tempHostId: updatedTempHostId,
					hostDisconnectedAt: updatedHostDisconnectedAt
				};
				room = updatedRoom;
				roomRepo.update(updatedRoom.id, updatedRoom, true);
				p2p?.broadcast({ type: 'sync_room', room: updatedRoom });

				if (gameDoc) {
					p2p?.broadcast({ type: 'sync_doc', roomId: updatedRoom.id, doc: gameDoc });
				}

				if (wasDisconnected || notices.some((n) => n.playerId === joiningPlayer.id)) {
					addNotice({
						playerId: joiningPlayer.id,
						playerName: joiningPlayer.displayName,
						type: 'reconnected'
					});
				}
			},
			onPeerConnectionChange(peerId, isConnected) {
				if (!room) return;
				const player = room.players.find((p) => p.id === peerId);
				if (!player || player.isConnected === isConnected) return;

				// Check if the host disconnected and we need to elect a temporary host
				if (peerId === room.hostId && !isConnected) {
					const originalHostId = room.hostId;
					const updatedPlayers = room.players.map((p) =>
						p.id === peerId ? { ...p, isConnected: false, lastSeen: Date.now() } : p
					);
					const candidateNextHost = updatedPlayers.find(
						(p) => p.id !== originalHostId && p.isConnected && !isAiPlayer(p.id)
					);
					if (candidateNextHost) {
						const updatedRoom: GameRoom = {
							...room,
							players: updatedPlayers,
							tempHostId: candidateNextHost.id,
							hostDisconnectedAt: Date.now()
						};
						room = updatedRoom;
						if (candidateNextHost.id === myPlayer.id) {
							roomRepo.update(updatedRoom.id, updatedRoom, true);
							p2p?.broadcast({ type: 'sync_room', room: updatedRoom });
						}
						startHostGraceCountdown(updatedRoom);
						return;
					}
				}

				// Check if the original host reconnected within grace period
				const currentHostId = room.hostId;
				if (peerId === currentHostId && isConnected) {
					stopHostGraceCountdown();
					const updatedPlayers = room.players.map((p) =>
						p.id === peerId
							? { ...p, isConnected: true, lastSeen: Date.now(), isAiControlled: false, isHost: true }
							: { ...p, isHost: p.id === currentHostId }
					);
					const updatedRoom: GameRoom = {
						...room,
						players: updatedPlayers,
						tempHostId: undefined,
						hostDisconnectedAt: undefined
					};
					room = updatedRoom;
					roomRepo.update(updatedRoom.id, updatedRoom, true);
					p2p?.broadcast({ type: 'sync_room', room: updatedRoom });
					if (gameDoc) {
						p2p?.broadcast({ type: 'sync_doc', roomId: updatedRoom.id, doc: gameDoc });
					}
					addNotice({
						playerId: peerId,
						playerName: player.displayName,
						type: 'reconnected'
					});
					return;
				}

				if (!isActingHost) return;

				const updatedPlayers = room.players.map((p) =>
					p.id === peerId
						? {
								...p,
								isConnected,
								lastSeen: Date.now(),
								isAiControlled: isConnected ? false : p.isAiControlled
						  }
						: p
				);
				const updatedRoom = { ...room, players: updatedPlayers };
				room = updatedRoom;
				roomRepo.update(updatedRoom.id, updatedRoom, true);
				p2p?.broadcast({ type: 'sync_room', room: updatedRoom });

				if (isConnected && gameDoc) {
					p2p?.broadcast({ type: 'sync_doc', roomId: updatedRoom.id, doc: gameDoc });
				}

				if (!isConnected) {
					addNotice({
						playerId: player.id,
						playerName: player.displayName,
						type: 'disconnected',
						isAiControlled: player.isAiControlled
					});
				} else {
					addNotice({
						playerId: player.id,
						playerName: player.displayName,
						type: 'reconnected'
					});
				}
			},
			onPlayerLeave(roomId, playerId) {
				if (!room || room.id !== roomId) return;
				const player = room.players.find((p) => p.id === playerId);
				if (!player) return;

				if (playerId === room.hostId) {
					const originalHostId = room.hostId;
					const updatedPlayers = room.players.map((p) =>
						p.id === playerId ? { ...p, isConnected: false, lastSeen: Date.now() } : p
					);
					const candidateNextHost = updatedPlayers.find(
						(p) => p.id !== originalHostId && p.isConnected && !isAiPlayer(p.id)
					);
					if (candidateNextHost) {
						const updatedRoom: GameRoom = {
							...room,
							players: updatedPlayers,
							tempHostId: candidateNextHost.id,
							hostDisconnectedAt: Date.now()
						};
						room = updatedRoom;
						if (candidateNextHost.id === myPlayer.id) {
							roomRepo.update(updatedRoom.id, updatedRoom, true);
							p2p?.broadcast({ type: 'sync_room', room: updatedRoom });
						}
						startHostGraceCountdown(updatedRoom);
						return;
					}
				}

				if (isActingHost) {
					const updatedPlayers = room.players.map((p) =>
						p.id === playerId ? { ...p, isConnected: false, lastSeen: Date.now() } : p
					);
					const updatedRoom = { ...room, players: updatedPlayers };
					room = updatedRoom;
					roomRepo.update(updatedRoom.id, updatedRoom, true);
					p2p?.broadcast({ type: 'sync_room', room: updatedRoom });
				}

				addNotice({
					playerId: player.id,
					playerName: player.displayName,
					type: 'disconnected',
					isAiControlled: player.isAiControlled
				});
			},
			onRoomMessage(updatedRoom) {
				if (!updatedRoom || !updatedRoom.id) return;
				if (updatedRoom.phase === 'gameOver' && (!updatedRoom.players || updatedRoom.players.length === 0)) {
					// Host deleted the room - cleanly return guest to lobby
					docDedup.clear();
					room = null;
					roomId = '';
					gameDoc = null;
					networkStatus = null;
					activeSession = null;
					showRejoinModal = false;
					if (typeof window !== 'undefined') {
						sessionStorage.removeItem('cards_active_room_code');
						localStorage.removeItem(ACTIVE_SESSION_KEY);
						window.location.hash = '';
					}
					void roomRepo.delete(updatedRoom.id);
					return;
				}
				if (room && updatedRoom.players) {
					for (const p of updatedRoom.players) {
						const prev = room.players.find((oldP) => oldP.id === p.id);
						if (prev && prev.isConnected !== p.isConnected && p.id !== myPlayer.id) {
							addNotice({
								playerId: p.id,
								playerName: p.displayName,
								type: p.isConnected ? 'reconnected' : 'disconnected',
								isAiControlled: p.isAiControlled
							});
						}
					}
				}
				if (updatedRoom.tempHostId && updatedRoom.hostDisconnectedAt) {
					if (!hostGraceTimer) {
						startHostGraceCountdown(updatedRoom);
					}
				} else if (!updatedRoom.tempHostId && hostGraceTimer) {
					stopHostGraceCountdown();
				}
				const isNewOrChanged = !room || room.id !== updatedRoom.id || JSON.stringify(room) !== JSON.stringify(updatedRoom);
				if (isNewOrChanged) {
					room = updatedRoom;
					roomId = updatedRoom.id;
					roomRepo.update(updatedRoom.id, updatedRoom, false);
				}
				if (!isActingHost && (updatedRoom.phase === 'playing' || updatedRoom.phase === 'roundScoring')) {
					p2p?.broadcast({ type: 'query_doc', roomId: updatedRoom.id });
				}
			},
			onDocMessage(docRoomId, doc) {
				if (!doc) return;
				const targetRoomId = room?.id ?? doc.roomId ?? docRoomId;
				if (!roomId && (room?.id === docRoomId || room?.code === docRoomId || doc.roomId === room?.id)) {
					roomId = targetRoomId;
				}
				if (docRoomId !== roomId && room?.id !== docRoomId && room?.code !== docRoomId && doc.roomId !== roomId) return;
				// Monotonic Move Reconciliation & Dedup
				if (!shouldAcceptDocUpdate(doc, gameDoc)) {
					return;
				}
				if (docDedup.has(doc)) {
					return;
				}
				docDedup.add(doc);
				if (gameDoc && JSON.stringify(gameDoc) === JSON.stringify(doc)) {
					return;
				}
				gameDoc = doc;
				sync.publish(targetRoomId, doc, false);
			},
			onQueryRoom() {
				if (room && isActingHost) {
					p2p?.broadcast({ type: 'sync_room', room });
				}
			},
			onQueryDoc(docRoomId) {
				if (gameDoc && isActingHost && (roomId === docRoomId || room?.id === docRoomId || room?.code === docRoomId)) {
					p2p?.broadcast({ type: 'sync_doc', roomId: room?.id ?? docRoomId, doc: gameDoc });
				}
			}
		});
	}
	const roomRepo = createLocalP2pRoomRepo(() => p2p);
	const sync = createLocalP2pSync(() => p2p);

	// Lobby UI state
	let selectedGameId = $state(games[0]?.id ?? 'oh-well');
	let playerCount = $state(4);
	let joinCode = $state('');
	let lobbyError = $state('');
	let loading = $state(false);

	const selectedGame = $derived(games.find((g) => g.id === selectedGameId));
	const playerOptions = $derived.by(() => {
		if (!selectedGame) return [4];
		const opts: number[] = [];
		for (let n = selectedGame.minPlayers; n <= selectedGame.maxPlayers; n++) opts.push(n);
		return opts;
	});

	$effect(() => {
		if (selectedGame && !playerOptions.includes(playerCount)) {
			playerCount = playerOptions[0];
		}
	});

	// Derived room and game state
	const actions = $derived(createRoomActions({ roomRepo, sync, roomId }));
	const isFull = $derived(room ? room.players.length >= room.maxPlayers : false);
	const playerIds = $derived((room?.players ?? []).map((p) => p.id));
	const playerNames = $derived(buildPlayerNames(room?.players ?? []));
	const gameId = $derived(room?.gameDefinitionId ?? '');
	const isOhWell = $derived(gameId === 'oh-well');
	const runtime = $derived(room ? getGame(gameId) : null);
	const gs = $derived(deriveRoomGs({ gameDoc, player: myPlayer, room, playerIds, runtime }));
	const ohWellUi = $derived(isOhWell && gs ? getOhWellUiState(gs) : null);
	const trumpSuit = $derived(ohWellUi?.trumpSuit ?? null);
	const showOhWellBidding = $derived(Boolean(isOhWell && gs && isOhWellBiddingPhase(gs)));
	const otherPlayers = $derived((room?.players ?? []).filter((p) => p.id !== myPlayer.id));

	const aiDeps = $derived({ isHost: isActingHost, gameDoc, gs, playerIds, runtime, actions, room, getRoom: () => room });
	const cardParams = $derived({ gameDoc, playerId: myPlayer.id, actions });
	const nrDeps = $derived({
		runtime: runtime!,
		gameDoc: gameDoc!,
		gs: gs!,
		playerIds,
		room,
		actions
	});

	// Reactive Room & Game Subscriptions
	$effect(() => {
		if (!roomId) return;
		return roomRepo.onRoomChanged(roomId, (r) => (room = r));
	});

	$effect(() => {
		if (!roomId || !needsGameSync(room, false)) return;
		const unsub = createGameSyncManager(sync, roomId).subscribe((d) => (gameDoc = d));
		return () => unsub();
	});

	// Automated AI Turn loops
	$effect(() => setupTrickTakingAi({ ...aiDeps, isOhWell }));
	$effect(() => setupOhWellAiBid(aiDeps));

	// P2P lifecycle managed by p2p instance

	// Action Handlers
	async function handleCreateRoom() {
		if (!hasValidName) {
			isEditingName = true;
			lobbyError = 'Please enter your name above first';
			return;
		}
		lobbyError = '';
		loading = true;
		const code = generateRoomCode();
		p2p?.connect(code, myPlayer.id, true).catch(() => {});
		try {
			const newRoom = await roomRepo.create({
				code,
				gameDefinitionId: selectedGameId,
				hostId: myPlayer.id,
				maxPlayers: playerCount,
				players: [
					{
						id: myPlayer.id,
						displayName: myPlayer.displayName,
						isHost: true,
						isConnected: true,
						lastSeen: Date.now()
					}
				],
				playerIds: [myPlayer.id],
				phase: 'lobby',
				createdAt: Date.now()
			});
			room = newRoom;
			roomId = newRoom.id;
			if (typeof window !== 'undefined') {
				window.location.hash = '#code=' + code;
			}
		} catch (e: unknown) {
			lobbyError = (e as Error).message;
		} finally {
			loading = false;
		}
	}

	async function handleJoinRoom() {
		if (!hasValidName) {
			isEditingName = true;
			lobbyError = 'Please enter your name above first';
			return;
		}
		if (!joinCode.trim()) return;
		lobbyError = '';
		loading = true;
		const code = joinCode.trim().toUpperCase();
		if (typeof window !== 'undefined') {
			window.location.hash = '#code=' + code;
		}

		await p2p?.connect(code, myPlayer.id, false).catch(() => {});

		const myRoomPlayer: RoomPlayer = {
			id: myPlayer.id,
			displayName: myPlayer.displayName,
			isHost: false,
			isConnected: true,
			lastSeen: Date.now()
		};

		// 1. Send join_request to host over P2P network
		p2p?.broadcast({ type: 'join_request', code, player: myRoomPlayer });
		p2p?.broadcast({ type: 'query_room', code });
		p2p?.broadcast({ type: 'query_doc', roomId: code });

		// 2. Also check if room exists in local cache (same machine)
		try {
			let target = await roomRepo.getByCode(code);
			if (target) {
				const existingIndex = target.players.findIndex((p) => p.id === myPlayer.id);
				let updatedPlayers: RoomPlayer[];
				if (existingIndex >= 0) {
					updatedPlayers = [...target.players];
					updatedPlayers[existingIndex] = {
						...target.players[existingIndex],
						displayName: myPlayer.displayName,
						isConnected: true,
						lastSeen: Date.now(),
						isAiControlled: false
					};
				} else {
					updatedPlayers = [
						...target.players,
						{
							...myRoomPlayer,
							isHost: target.hostId === myPlayer.id
						}
					];
				}
				const updatedRoom = {
					...target,
					players: updatedPlayers,
					playerIds: updatedPlayers.map((p) => p.id)
				};
				await roomRepo.update(target.id, updatedRoom);
				room = updatedRoom;
				roomId = target.id;
				p2p?.broadcast({ type: 'sync_room', room: updatedRoom });
				p2p?.broadcast({ type: 'join_request', code, player: myRoomPlayer });
				if (target.phase === 'playing' || target.phase === 'roundScoring') {
					p2p?.broadcast({ type: 'query_doc', roomId: target.id });
				}
			} else {
				// Retry handshake over network up to 4 times (1s intervals)
				for (let attempt = 1; attempt <= 4; attempt++) {
					await new Promise((resolve) => setTimeout(resolve, 1000));
					if (room) break;
					p2p?.broadcast({ type: 'join_request', code, player: myRoomPlayer });
					p2p?.broadcast({ type: 'query_room', code });
					p2p?.broadcast({ type: 'query_doc', roomId: code });
				}
				if (!room) {
					lobbyError = `Unable to connect to table ${code}. Verify the room code or check network connection.`;
				}
			}
		} catch (e: unknown) {
			lobbyError = (e as Error).message;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		function syncHash() {
			if (typeof window === 'undefined') return;
			const match = window.location.hash.match(/code=([A-Z0-9]{4,6})/i);
			const activeCode = match?.[1]?.toUpperCase();
			if (activeCode && !roomId && !room && !loading) {
				joinCode = activeCode;
				if (hasValidName) {
					handleJoinRoom();
				} else {
					isEditingName = true;
					lobbyError = 'Enter your name above to join table ' + activeCode;
				}
			}
		}
		syncHash();
		window.addEventListener('hashchange', syncHash);
		return () => window.removeEventListener('hashchange', syncHash);
	});

	// Active game session persistence for rejoin modal
	const ACTIVE_SESSION_KEY = 'cards_last_active_session';
	let activeSession = $state<ActiveGameSession | null>(null);
	let showRejoinModal = $state(false);

	$effect(() => {
		if (typeof window === 'undefined') return;
		if (!room && !roomId) {
			const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
			if (raw) {
				try {
					const parsed = JSON.parse(raw);
					if (parsed?.code && parsed?.gameName) {
						if (Date.now() - (parsed.timestamp || 0) < 6 * 3600 * 1000) {
							void roomRepo.getByCode(parsed.code).then((target) => {
								if (shouldPruneActiveSession(target, myPlayer.id, parsed.hostId)) {
									if (target) {
										void roomRepo.delete(target.id);
									}
									localStorage.removeItem(ACTIVE_SESSION_KEY);
									activeSession = null;
									showRejoinModal = false;
									return;
								}
								activeSession = parsed;
								showRejoinModal = true;
							});
						} else {
							localStorage.removeItem(ACTIVE_SESSION_KEY);
							activeSession = null;
							showRejoinModal = false;
						}
					}
				} catch {
					localStorage.removeItem(ACTIVE_SESSION_KEY);
					activeSession = null;
					showRejoinModal = false;
				}
			}
		} else {
			showRejoinModal = false;
		}
	});

	$effect(() => {
		if (typeof window === 'undefined') return;
		if (room && room.code) {
			if (room.phase === 'gameOver' || (room.players && room.players.length === 0)) {
				localStorage.removeItem(ACTIVE_SESSION_KEY);
				sessionStorage.removeItem('cards_active_room_code');
				activeSession = null;
				showRejoinModal = false;
				return;
			}
			sessionStorage.setItem('cards_active_room_code', room.code);
			const sessionData: ActiveGameSession = {
				code: room.code,
				gameDefinitionId: room.gameDefinitionId,
				gameName: getGame(room.gameDefinitionId)?.name || 'Cards',
				hostId: room.hostId,
				timestamp: Date.now()
			};
			localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(sessionData));
		}
	});

	$effect(() => {
		if (typeof window === 'undefined') return;
		function handleBeforeUnload() {
			if (room) {
				if (shouldDestroyRoomOnHostLeave(room, myPlayer.id, isActingHost || isHost)) {
					localStorage.removeItem(ACTIVE_SESSION_KEY);
					sessionStorage.removeItem('cards_active_room_code');
					void roomRepo.delete(room.id);
					void actions.destroyRoom();
				} else {
					void p2p?.broadcast({
						type: 'player_leave',
						roomId: room.id,
						playerId: myPlayer.id
					});
				}
			}
		}
		function handleVisibilityChange() {
			if (!document.hidden && room && !isActingHost) {
				p2p?.broadcast({ type: 'query_room', code: room.code });
				p2p?.broadcast({ type: 'query_doc', roomId: room.id });
			}
		}
		window.addEventListener('beforeunload', handleBeforeUnload);
		document.addEventListener('visibilitychange', handleVisibilityChange);
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	});

	function handleRejoinActiveSession(code: string) {
		showRejoinModal = false;
		joinCode = code;
		handleJoinRoom();
	}

	function handleDismissActiveSession() {
		showRejoinModal = false;
		activeSession = null;
		if (typeof window !== 'undefined') {
			localStorage.removeItem(ACTIVE_SESSION_KEY);
			sessionStorage.removeItem('cards_active_room_code');
			if (window.location.hash) {
				window.location.hash = '';
			}
		}
	}

	async function handleHostPlayTurn(targetPlayerId: string) {
		if (!isActingHost || !room || !gameDoc || !gs || !runtime) return;
		const currentTurnPlayerId = playerIds[gs.currentTurnIndex];
		if (currentTurnPlayerId !== targetPlayerId) {
			return;
		}

		if (isOhWell && showOhWellBidding) {
			const bidderId = getCurrentOhWellBidderId(gameDoc);
			if (bidderId === targetPlayerId) {
				const bid = computeOhWellAiBid(gameDoc);
				const updated = handleOhWellBid({ doc: gameDoc, playerId: bidderId, bid });
				await actions.updateGameState(updated);
			}
		} else {
			await executeSingleSkipTurn({
				runtime,
				doc: gameDoc,
				playerIds,
				currentId: targetPlayerId,
				actions
			});
		}
	}

	async function handleHostToggleAi(targetPlayerId: string) {
		if (!isActingHost || !room) return;
		const target = room.players.find((p) => p.id === targetPlayerId);
		if (!target) return;

		const nextAiState = !target.isAiControlled;
		const updatedPlayers = room.players.map((p) =>
			p.id === targetPlayerId ? { ...p, isAiControlled: nextAiState } : p
		);
		const updatedRoom = { ...room, players: updatedPlayers };
		room = updatedRoom;
		await roomRepo.update(room.id, updatedRoom, true);
		p2p?.broadcast({ type: 'sync_room', room: updatedRoom });

		notices = notices.map((n) =>
			n.playerId === targetPlayerId ? { ...n, isAiControlled: nextAiState } : n
		);
	}

	const handleAddAiPlayer = async () => {
		if (room && !isFull) {
			aiCounter = await handleAddAi({ room, isFull, aiCounter, roomId, roomRepo });
		}
	};

	const onStart = () => handleStart({ gameId, playerIds, roomId, actions, roomRepo });
	const onNextRound = () => handleNextRound(gameId, nrDeps);
	const onPlayCard = (card: CardType) => {
		if (showOhWellBidding) return;
		handlePlayCard(cardParams, card);
	};
	const onOhWellBid = (bid: number) => handleOhWellBidAction(cardParams, bid);
	const handleBackToLobby = async () => {
		gameDoc = null;
		await actions.returnToLobby();
	};
	const onLeave = async () => {
		const currentRoom = room;
		const isMeHost = isActingHost || isHost;
		const mustDestroy = shouldDestroyRoomOnHostLeave(currentRoom, myPlayer.id, isMeHost);

		if (mustDestroy) {
			activeSession = null;
			showRejoinModal = false;
			if (typeof window !== 'undefined') {
				localStorage.removeItem(ACTIVE_SESSION_KEY);
				sessionStorage.removeItem('cards_active_room_code');
				if (window.location.hash) window.location.hash = '';
			}
			if (currentRoom) {
				void roomRepo.delete(currentRoom.id);
				await actions.destroyRoom();
			}
		} else if (currentRoom) {
			await p2p?.broadcast({
				type: 'player_leave',
				roomId: currentRoom.id,
				playerId: myPlayer.id
			});
		}

		docDedup.clear();
		p2p?.destroy();
		networkStatus = null;
		roomId = '';
		room = null;
		gameDoc = null;
		activeSession = null;
		showRejoinModal = false;
		if (typeof window !== 'undefined') {
			sessionStorage.removeItem('cards_active_room_code');
			window.location.hash = '';
		}
	};
	const activeGameTitle = $derived(
		room ? getGame(room.gameDefinitionId).name : 'Cards'
	);
</script>

<div
	data-network-mode={networkStatus?.mode ?? 'unknown'}
	data-peer-count={networkStatus?.directPeersCount ?? 0}
	class="bg-background text-foreground flex flex-col felt-table-surface {room && gs ? 'h-[100dvh] max-h-[100dvh] overflow-hidden' : 'min-h-screen'}"
>
	<NavBar
		displayName={myPlayer.displayName}
		title={activeGameTitle}
		onNameChange={!room ? savePlayerName : undefined}
		roundLabel={gameDoc && runtime ? runtime.getRoundLabel(gameDoc.currentRound) : ''}
		currentRound={gameDoc?.currentRound ?? 0}
		roundRules={gameDoc && runtime ? runtime.getRoundRules(gameDoc.currentRound) : ''}
		trumpSuit={trumpSuit}
		trumpCard={ohWellUi?.trumpCard ?? null}
		handType={gs?.handType ?? ''}
		networkStatus={networkStatus}
	/>

	{#if !room}
		<main class="max-w-xl self-center mx-auto p-4 sm:p-8 flex flex-col gap-6 flex-1 w-full justify-center">
			<div class="text-center flex flex-col gap-1.5 mb-2">
				<h2 class="text-3xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200 bg-clip-text text-transparent">
					Tabletop Card Arena
				</h2>
				<p class="text-sm text-muted-foreground">Select a game, invite friends, or test against AI bots</p>
			</div>

			{#if lobbyError}
				<p class="text-destructive text-xs bg-destructive/10 p-3 rounded-lg border border-destructive/20">{lobbyError}</p>
			{/if}

			<Card class="border-border/80 bg-card/90 shadow-xl backdrop-blur-md">
				<CardContent class="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div class="flex items-center gap-3.5 min-w-0">
						<div class="w-11 h-11 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-sm font-black shrink-0">
							{getInitials(playerName || 'Player')}
						</div>
						<div class="flex flex-col min-w-0">
							<span class="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Player Name</span>
							{#if isEditingName || !hasValidName}
								<form onsubmit={(e) => { e.preventDefault(); savePlayerName(nameInput); }} class="flex items-center gap-2 mt-1.5">
									<Input
										class="text-sm h-9 w-44 sm:w-56 font-bold"
										placeholder="Enter your name..."
										bind:value={nameInput}
										maxlength={20}
										autofocus
									/>
									<Button
										type="submit"
										size="sm"
										class="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg cursor-pointer"
										disabled={!nameInput.trim()}
									>
										Save
									</Button>
								</form>
							{:else}
								<span class="text-base font-black truncate max-w-[200px] sm:max-w-[280px] text-foreground">{playerName}</span>
							{/if}
						</div>
					</div>
					{#if hasValidName && !isEditingName}
						<Button
							variant="outline"
							size="sm"
							class="text-xs h-8 border-border/80 hover:bg-background/80 shrink-0 font-semibold self-start sm:self-center cursor-pointer"
							onclick={() => { nameInput = playerName; isEditingName = true; }}
						>
							Change Name
						</Button>
					{/if}
				</CardContent>
			</Card>

			<Card class="border-border/80 bg-card/90 shadow-xl backdrop-blur-md">
				<CardHeader class="pb-3">
					<CardTitle class="text-lg font-black flex items-center justify-between">
						<span>Create a Match</span>
						<span class="text-xs text-muted-foreground font-semibold">Step 1: Choose game</span>
					</CardTitle>
				</CardHeader>
				<CardContent class="gap-5">
					<div class="grid grid-cols-2 gap-3">
						{#each games as game (game.id)}
							<button
								class="rounded-2xl border-2 p-4 sm:p-5 text-left transition-all cursor-pointer relative overflow-hidden group {selectedGameId === game.id
									? 'border-emerald-500 bg-emerald-950/30'
									: 'border-border/80 bg-background/50 hover:border-border hover:bg-card'}"
								onclick={() => (selectedGameId = game.id)}
							>
								<div class="flex items-center justify-between">
									<span class="block text-base font-extrabold text-foreground group-hover:text-emerald-400 transition-colors">{game.name}</span>
									<span class="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-all {selectedGameId === game.id ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/40 shadow-xs' : 'border border-border/80 text-transparent'}">
										✓
									</span>
								</div>
								<span class="block text-xs text-muted-foreground mt-1 font-medium">
									{game.minPlayers === game.maxPlayers
										? `${game.minPlayers} players`
										: `${game.minPlayers}–${game.maxPlayers} players`}
								</span>
							</button>
						{/each}
					</div>

					<div class="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-background/60 rounded-xl border border-border/80 gap-2">
						<span class="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Players</span>
						<div class="grid grid-cols-4 gap-1.5 sm:flex sm:items-center">
							{#each playerOptions as n (n)}
								<button
									type="button"
									data-player-count={n}
									aria-label={`${n} Players`}
									class="rounded-lg px-3.5 py-1.5 min-w-[36px] h-9 text-xs font-bold transition-all cursor-pointer text-center flex items-center justify-center {playerCount === n
										? 'bg-emerald-500 text-zinc-950 font-black shadow-sm'
										: 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}"
									onclick={() => (playerCount = n)}
								>
									{n}
								</button>
							{/each}
						</div>
					</div>

					<Button
						class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 h-12 shadow-lg shadow-emerald-950/40 text-base rounded-xl"
						onclick={handleCreateRoom}
						disabled={loading || !hasValidName}
					>
						{loading ? 'Creating...' : !hasValidName ? 'Enter Name Above to Play' : 'Create Table'}
					</Button>
				</CardContent>
			</Card>
			<Card class="border-border/80 bg-card/90 shadow-xl backdrop-blur-md">
				<CardHeader class="pb-3">
					<CardTitle class="text-lg font-black">Join Existing Table</CardTitle>
				</CardHeader>
				<CardContent class="gap-4">
					<Input
						bind:value={joinCode}
						placeholder="ROOM CODE"
						maxlength={6}
						class="text-center font-mono tracking-[0.25em] text-2xl font-black uppercase h-14 rounded-xl border-2 border-border/80 focus:border-emerald-500 focus:outline-none bg-background/70 placeholder:text-muted-foreground/35 placeholder:font-bold"
					/>
					<Button
						variant="secondary"
						class="w-full font-bold text-sm h-12 rounded-xl border border-border/80 hover:bg-card"
						onclick={handleJoinRoom}
						disabled={loading || joinCode.length < 4 || !hasValidName}
					>
						{loading ? 'Joining...' : !hasValidName ? 'Enter Name Above to Join' : 'Join Game'}
					</Button>
				</CardContent>
			</Card>
		</main>
	{:else if room.phase === 'lobby'}
		<RoomLobby
			{room}
			isHost={isActingHost}
			{isFull}
			{onStart}
			{onLeave}
			onAddAi={handleAddAiPlayer}
		/>
	{:else if gs}
		<GameSession
			{gameId}
			{trumpSuit}
			{gs}
			currentRound={gameDoc?.currentRound ?? 0}
			roundLabel={runtime?.getRoundLabel(gameDoc?.currentRound ?? 0) ?? ''}
			roundRules={runtime?.getRoundRules(gameDoc?.currentRound ?? 0) ?? ''}
			{playerNames}
			{playerIds}
			isHost={isActingHost}
			myId={myPlayer.id}
			{otherPlayers}
			allPlayers={room?.players ?? []}
			allRounds={computeAllRounds({ gameDoc, gs, runtime })}
			onCardPlayed={onPlayCard}
			{onNextRound}
			onBackToLobby={handleBackToLobby}
			{onLeave}
			showBidding={showOhWellBidding}
			onBid={onOhWellBid}
		/>
	{:else}
		<div class="flex items-center justify-center min-h-[50vh]">
			<p class="text-muted-foreground text-sm animate-pulse">Initializing game session...</p>
		</div>
	{/if}

	<DisconnectionToast
		{notices}
		isHost={isActingHost}
		onPlayTurn={handleHostPlayTurn}
		onToggleAi={handleHostToggleAi}
		onDismissNotice={dismissNotice}
	/>

	<RejoinModal
		open={showRejoinModal}
		session={activeSession}
		onRejoin={handleRejoinActiveSession}
		onDismiss={handleDismissActiveSession}
	/>
</div>
