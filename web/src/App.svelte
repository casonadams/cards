<script lang="ts">
	import init, { IrohNode } from './wasm/cards_wasm.js';
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
	import OhWellBidding from '$lib/components/oh-well-bidding.svelte';
	import { Button } from '$lib/components/ui/button/index';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card/index';
	import { Input } from '$lib/components/ui/input/index';
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
			? localStorage.getItem('cards_player_name') || 'Player'
			: 'Player'
	);
	const myPlayer = $derived<Player>({
		id: playerId,
		displayName: playerName
	});

	function handleNameChange(name: string) {
		playerName = name;
		if (typeof window !== 'undefined') {
			localStorage.setItem('cards_player_name', name);
		}
	}

	// Platform state
	let irohRoom = $state<any>(null);
	const roomRepo = createLocalP2pRoomRepo(() => irohRoom);
	const sync = createLocalP2pSync(() => irohRoom);
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
	const showOhWellBidding = $derived(isOhWell && gs && isOhWellBiddingPhase(gs));
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

	function listenIroh(r: { take_stream: () => { getReader: () => { read: () => Promise<{ value: { type: string; payload: string } | undefined; done: boolean }> } } }) {
		try {
			const stream = r.take_stream();
			const reader = stream.getReader();
			(async () => {
				while (true) {
					const { value, done } = await reader.read();
					if (done) break;
					if (value && value.type === 'message') {
						try {
							const data = JSON.parse(value.payload);
							if (data.type === 'sync_doc' && data.doc) {
								gameDoc = data.doc;
							} else if (data.type === 'sync_room' && data.room) {
								room = data.room;
								roomId = data.room.id;
								await roomRepo.update(data.room.id, data.room);
							}
						} catch {
							// Ignore non-json
						}
					}
				}
			})();
		} catch (e) {
			console.log('Iroh stream error', e);
		}
	}

	// Action Handlers
	async function handleCreateRoom() {
		lobbyError = '';
		loading = true;
		const code = generateRoomCode();
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
		if (!joinCode.trim()) return;
		lobbyError = '';
		loading = true;
		const code = joinCode.trim().toUpperCase();
		if (typeof window !== 'undefined') {
			window.location.hash = '#code=' + code;
		}
		try {
			let target = await roomRepo.getByCode(code);
			if (!target) {
				target = await roomRepo.create({
					code,
					gameDefinitionId: 'canadian-salad',
					hostId: 'host-player',
					maxPlayers: 4,
					players: [],
					playerIds: [],
					phase: 'lobby',
					createdAt: Date.now()
				});
			}
			const existingIndex = target.players.findIndex((p) => p.id === myPlayer.id);
			let updatedPlayers: RoomPlayer[];
			if (existingIndex >= 0) {
				updatedPlayers = [...target.players];
				updatedPlayers[existingIndex] = {
					id: myPlayer.id,
					displayName: myPlayer.displayName,
					isHost: false,
					isConnected: true,
					lastSeen: Date.now()
				};
			} else {
				updatedPlayers = [
					...target.players,
					{
						id: myPlayer.id,
						displayName: myPlayer.displayName,
						isHost: false,
						isConnected: true,
						lastSeen: Date.now()
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
		} catch (e: unknown) {
			lobbyError = (e as Error).message;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		function syncHash() {
			if (typeof window !== 'undefined' && window.location.hash.includes('code=')) {
				const match = window.location.hash.match(/code=([A-Z0-9]{4,6})/i);
				if (match && match[1] && !roomId && !room && !loading) {
					const targetCode = match[1].toUpperCase();
					if (joinCode !== targetCode) {
						joinCode = targetCode;
						handleJoinRoom();
					}
				}
			}
		}
		syncHash();
		window.addEventListener('hashchange', syncHash);
		return () => window.removeEventListener('hashchange', syncHash);
	});

	const handleAddAiPlayer = async () => {
		if (room && !isFull) {
			aiCounter = await handleAddAi({ room, isFull, aiCounter, roomId, roomRepo });
		}
	};

	const onStart = () => handleStart({ gameId, playerIds, roomId, actions, roomRepo });
	const onNextRound = () => handleNextRound(gameId, nrDeps);
	const onPlayCard = (card: CardType) => handlePlayCard(cardParams, card);
	const onOhWellBid = (bid: number) => handleOhWellBidAction(cardParams, bid);
	const handleBackToLobby = async () => {
		gameDoc = null;
		await actions.returnToLobby();
	};
	const onLeave = async () => {
		if (isHost) {
			await actions.destroyRoom();
		}
		roomId = '';
		room = null;
		gameDoc = null;
		if (typeof window !== 'undefined') {
			window.location.hash = '';
		}
	};
</script>

<div class="min-h-screen bg-background text-foreground flex flex-col felt-table-surface">
	<NavBar
		displayName={myPlayer.displayName}
		onNameChange={handleNameChange}
	/>

	{#if !room}
		<main class="max-w-lg self-center mx-auto p-4 sm:p-6 space-y-5 flex-1 w-full flex flex-col justify-center">
			<div class="text-center space-y-1 mb-1">
				<h2 class="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200 bg-clip-text text-transparent">
					Tabletop Card Arena
				</h2>
				<p class="text-xs text-muted-foreground">Select a game, invite friends, or test against AI bots</p>
			</div>

			{#if lobbyError}
				<p class="text-destructive text-xs bg-destructive/10 p-3 rounded-lg border border-destructive/20">{lobbyError}</p>
			{/if}

			<Card class="border-border/80 bg-card/90 shadow-xl backdrop-blur-md">
				<CardHeader class="pb-3">
					<CardTitle class="text-base font-bold flex items-center justify-between">
						<span>Create a Match</span>
						<span class="text-xs text-muted-foreground font-normal">Step 1: Choose game</span>
					</CardTitle>
				</CardHeader>
				<CardContent class="space-y-4">
					<div class="grid grid-cols-2 gap-2.5">
						{#each games as game (game.id)}
							<button
								class="rounded-xl border p-3 text-left transition-all cursor-pointer relative overflow-hidden group {selectedGameId === game.id
									? 'border-emerald-500/80 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30'
									: 'border-border/80 bg-background/50 hover:border-border hover:bg-card'}"
								onclick={() => (selectedGameId = game.id)}
							>
								<div class="flex items-center justify-between">
									<span class="block text-sm font-bold text-foreground group-hover:text-emerald-400 transition-colors">{game.name}</span>
									{#if selectedGameId === game.id}
										<span class="text-xs text-emerald-400">✓</span>
									{/if}
								</div>
								<span class="block text-[11px] text-muted-foreground mt-0.5">
									{game.minPlayers === game.maxPlayers
										? `${game.minPlayers} players`
										: `${game.minPlayers}–${game.maxPlayers} players`}
								</span>
							</button>
						{/each}
					</div>

					<div class="flex items-center justify-between p-1.5 bg-background/60 rounded-lg border border-border/80">
						<span class="text-xs font-medium text-muted-foreground px-2">Table Size</span>
						<div class="flex gap-1">
							{#each playerOptions as n (n)}
								<button
									class="rounded-md px-3 py-1 text-xs font-bold transition-all cursor-pointer {playerCount === n
										? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
										: 'text-muted-foreground hover:text-foreground'}"
									onclick={() => (playerCount = n)}
								>
									{n} Players
								</button>
							{/each}
						</div>
					</div>

					<Button
						class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 shadow-md shadow-emerald-950/40 text-sm"
						onclick={handleCreateRoom}
						disabled={loading}
					>
						{loading ? 'Creating...' : 'Create Table'}
					</Button>
				</CardContent>
			</Card>

			<Card class="border-border/80 bg-card/90 shadow-xl backdrop-blur-md">
				<CardHeader class="pb-3">
					<CardTitle class="text-base font-bold">Join Existing Table</CardTitle>
				</CardHeader>
				<CardContent class="space-y-3">
					<Input
						bind:value={joinCode}
						placeholder="ROOM CODE"
						maxlength={6}
						class="text-center font-mono tracking-widest text-lg font-black uppercase h-11 border-border/80 focus:border-emerald-500"
					/>
					<Button
						variant="secondary"
						class="w-full font-semibold text-xs h-10 border border-border/80 hover:bg-card"
						onclick={handleJoinRoom}
						disabled={loading || joinCode.length < 4}
					>
						{loading ? 'Joining...' : 'Join Game'}
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
		/>

		{#if showOhWellBidding && ohWellUi}
			<OhWellBidding
				uiState={ohWellUi}
				myHand={gs.myRemainingHand}
				{playerNames}
				onBid={onOhWellBid}
			/>
		{/if}
	{:else}
		<div class="flex items-center justify-center min-h-[50vh]">
			<p class="text-muted-foreground text-sm animate-pulse">Initializing game session...</p>
		</div>
	{/if}
</div>
