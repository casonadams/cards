<script lang="ts">
	import { registerAllGames } from '$lib/games/register-all';
	import { getGame, listGames, createGameSyncManager } from '$lib/platform/engine/index';
	import { createRoomActions } from '$lib/platform/stores/room-store';
	import type { GameRoom, Player, Card as CardType } from '$lib/platform/types/index';
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

	// Persistent player profile
	let playerName = $state(
		typeof window !== 'undefined'
			? localStorage.getItem('cards_player_name') || 'Player'
			: 'Player'
	);
	const myPlayer = $derived<Player>({
		id: 'human-player',
		displayName: playerName
	});

	function handleNameChange(name: string) {
		playerName = name;
		if (typeof window !== 'undefined') {
			localStorage.setItem('cards_player_name', name);
		}
	}

	// Platform state
	const roomRepo = createLocalP2pRoomRepo();
	const sync = createLocalP2pSync();

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

	// Action Handlers
	async function handleCreateRoom() {
		lobbyError = '';
		loading = true;
		try {
			const newRoom = await roomRepo.create({
				code: '',
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
			roomId = newRoom.id;
		} catch (e: any) {
			lobbyError = e.message;
		} finally {
			loading = false;
		}
	}

	async function handleJoinRoom() {
		if (!joinCode.trim()) return;
		lobbyError = '';
		loading = true;
		try {
			const target = await roomRepo.getByCode(joinCode.trim().toUpperCase());
			if (!target) {
				lobbyError = `Room code "${joinCode.toUpperCase()}" not found.`;
				return;
			}
			if (target.players.length >= target.maxPlayers) {
				lobbyError = 'Room is already full.';
				return;
			}
			const updatedPlayers = [
				...target.players,
				{
					id: myPlayer.id,
					displayName: myPlayer.displayName,
					isHost: false,
					isConnected: true,
					lastSeen: Date.now()
				}
			];
			await roomRepo.update(target.id, {
				players: updatedPlayers,
				playerIds: updatedPlayers.map((p) => p.id)
			});
			roomId = target.id;
		} catch (e: any) {
			lobbyError = e.message;
		} finally {
			loading = false;
		}
	}

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
	};
</script>

<div class="min-h-screen bg-background text-foreground flex flex-col">
	<NavBar
		displayName={myPlayer.displayName}
		onNameChange={handleNameChange}
	/>

	{#if !room}
		<main class="max-w-lg mx-auto p-6 space-y-6 flex-1 w-full">
			{#if lobbyError}
				<p class="text-destructive text-sm bg-destructive/10 p-3 rounded-lg border border-destructive/20">{lobbyError}</p>
			{/if}

			<Card>
				<CardHeader>
					<CardTitle>Create Game</CardTitle>
				</CardHeader>
				<CardContent class="space-y-4">
					<div class="grid grid-cols-2 gap-2">
						{#each games as game (game.id)}
							<button
								class="rounded-lg border-2 p-3 text-left transition-all cursor-pointer {selectedGameId === game.id
									? 'border-primary bg-primary/10'
									: 'border-border hover:border-muted-foreground'}"
								onclick={() => (selectedGameId = game.id)}
							>
								<span class="block text-sm font-semibold">{game.name}</span>
								<span class="block text-xs text-muted-foreground">
									{game.minPlayers === game.maxPlayers
										? `${game.minPlayers} players`
										: `${game.minPlayers}-${game.maxPlayers} players`}
								</span>
							</button>
						{/each}
					</div>

					<div class="flex items-center gap-2">
						<span class="text-sm text-muted-foreground">Players</span>
						<div class="flex gap-1">
							{#each playerOptions as n (n)}
								<button
									class="rounded-md border px-3 py-1 text-sm font-medium transition-all cursor-pointer {playerCount === n
										? 'border-primary bg-primary/10 text-primary'
										: 'border-border text-muted-foreground hover:border-muted-foreground'}"
									onclick={() => (playerCount = n)}
								>
									{n}
								</button>
							{/each}
						</div>
					</div>

					<Button class="w-full" onclick={handleCreateRoom} disabled={loading}>
						{loading ? 'Creating...' : 'Create Room'}
					</Button>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Join Game</CardTitle>
				</CardHeader>
				<CardContent class="space-y-3">
					<Input
						bind:value={joinCode}
						placeholder="Enter room code (e.g. ABCDEF)"
						maxlength={6}
					/>
					<Button
						variant="secondary"
						class="w-full"
						onclick={handleJoinRoom}
						disabled={loading || joinCode.length < 4}
					>
						{loading ? 'Joining...' : 'Join Room'}
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
