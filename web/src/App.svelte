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
	import { P2pNetworkManager } from '$lib/platform/adapters/p2p-webrtc';
	import {
		deriveRoomGs,
		buildPlayerNames,
		needsGameSync
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
		isOhWellBiddingPhase
	} from '$lib/room/oh-well-helpers';
	import {
		setupTrickTakingAi,
		setupOhWellAiBid
	} from '$lib/room/ai-effects';

	// Components
	import NavBar from '$lib/components/nav-bar.svelte';
	import RoomLobby from '$lib/components/room-lobby.svelte';
	import GameSession from '$lib/components/game-session.svelte';
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
	let p2p: P2pNetworkManager | null = null;
	if (typeof window !== 'undefined') {
		p2p = new P2pNetworkManager({
			onJoinRequest(code, joiningPlayer) {
				if (!isHost || !room) return;
				if (room.code.trim().toUpperCase() !== code.trim().toUpperCase()) return;
				if (room.players.length >= room.maxPlayers) return;

				const existingIndex = room.players.findIndex((p) => p.id === joiningPlayer.id);
				let updatedPlayers: RoomPlayer[];
				if (existingIndex >= 0) {
					updatedPlayers = [...room.players];
					updatedPlayers[existingIndex] = {
						...room.players[existingIndex],
						displayName: joiningPlayer.displayName,
						isConnected: true,
						lastSeen: Date.now()
					};
				} else {
					updatedPlayers = [
						...room.players,
						{
							id: joiningPlayer.id,
							displayName: joiningPlayer.displayName,
							isHost: false,
							isConnected: true,
							lastSeen: Date.now()
						}
					];
				}
				const updatedRoom: GameRoom = {
					...room,
					players: updatedPlayers,
					playerIds: updatedPlayers.map((p) => p.id)
				};
				room = updatedRoom;
				roomRepo.update(updatedRoom.id, updatedRoom, true);
			},
			onRoomMessage(updatedRoom) {
				if (!updatedRoom || !updatedRoom.id) return;
				if (room && room.id === updatedRoom.id && JSON.stringify(room) === JSON.stringify(updatedRoom)) {
					return;
				}
				room = updatedRoom;
				roomId = updatedRoom.id;
				roomRepo.update(updatedRoom.id, updatedRoom, false);
			},
			onDocMessage(docRoomId, doc) {
				if (!doc) return;
				if (!roomId && room?.id === docRoomId) {
					roomId = docRoomId;
				}
				if (docRoomId !== roomId && room?.id !== docRoomId) return;
				if (gameDoc && JSON.stringify(gameDoc) === JSON.stringify(doc)) {
					return;
				}
				gameDoc = doc;
				sync.publish(docRoomId, doc, false);
			},
			onQueryRoom() {
				if (room) {
					p2p?.broadcast({ type: 'sync_room', room });
				}
			},
			onQueryDoc(docRoomId) {
				if (gameDoc && (roomId === docRoomId || room?.id === docRoomId)) {
					p2p?.broadcast({ type: 'sync_doc', roomId: docRoomId, doc: gameDoc });
				}
			}
		});
	}
	const roomRepo = createLocalP2pRoomRepo(() => p2p);
	const sync = createLocalP2pSync(() => p2p);
	let roomId = $state('');
	let room = $state<GameRoom | null>(null);
	let gameDoc = $state<GameDocument | null>(null);
	let aiCounter = $state(1);

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
	const isHost = $derived(room?.hostId === myPlayer.id);
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

	const aiDeps = $derived({ isHost, gameDoc, gs, playerIds, runtime, actions });
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
		p2p?.connect(code, myPlayer.id).catch(() => {});
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

		await p2p?.connect(code, myPlayer.id).catch(() => {});

		const myRoomPlayer: RoomPlayer = {
			id: myPlayer.id,
			displayName: myPlayer.displayName,
			isHost: false,
			isConnected: true,
			lastSeen: Date.now()
		};

		// 1. Send join_request to host over P2P network
		p2p?.broadcast({ type: 'join_request', code, player: myRoomPlayer });

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
						lastSeen: Date.now()
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
			const activeCode = match?.[1]?.toUpperCase() || sessionStorage.getItem('cards_active_room_code');
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

	$effect(() => {
		if (typeof window !== 'undefined' && room) {
			sessionStorage.setItem('cards_active_room_code', room.code);
		}
	});

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
		if (isHost) {
			await actions.destroyRoom();
		}
		p2p?.destroy();
		roomId = '';
		room = null;
		gameDoc = null;
		if (typeof window !== 'undefined') {
			sessionStorage.removeItem('cards_active_room_code');
			window.location.hash = '';
		}
	};
	const activeGameTitle = $derived(
		room ? getGame(room.gameDefinitionId).name : 'Cards'
	);
</script>

<div class="min-h-screen bg-background text-foreground flex flex-col felt-table-surface">
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
						<span class="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Table Size</span>
						<div class="grid grid-cols-4 gap-1.5 sm:flex">
							{#each playerOptions as n (n)}
								<button
									class="rounded-lg px-2.5 sm:px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer text-center {playerCount === n
										? 'bg-emerald-500 text-zinc-950 font-black shadow-sm'
										: 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}"
									onclick={() => (playerCount = n)}
								>
									<span class="sm:hidden">{n}P</span>
									<span class="hidden sm:inline">{n} Players</span>
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
			{isHost}
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
			{isHost}
			myId={myPlayer.id}
			{otherPlayers}
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
</div>
