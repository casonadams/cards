<script lang="ts">
	import init, { IrohNode, WasmOhWell, WasmCanadianSalad } from './wasm/cards_wasm.js';
	import { Button } from '$lib/components/ui/button/index';
	import { Badge } from '$lib/components/ui/badge/index';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card/index';
	import { Input } from '$lib/components/ui/input/index';
	import NavBar from '$lib/components/nav-bar.svelte';
	import RoomLobby, { type LobbyPlayer } from '$lib/components/room-lobby.svelte';
	import HandDisplay from '$lib/components/hand-display.svelte';
	import TrickArea, { type TrickPlay } from '$lib/components/trick-area.svelte';
	import LastTrick from '$lib/components/last-trick.svelte';
	import CanadianSaladPenalties from '$lib/components/canadian-salad-penalties.svelte';
	import OhWellTrumpBanner from '$lib/components/oh-well-trump-banner.svelte';
	import OhWellBidding from '$lib/components/oh-well-bidding.svelte';
	import RoundScoreOverlay from '$lib/components/round-score-overlay.svelte';
	import GameOverOverlay from '$lib/components/game-over-overlay.svelte';
	import { computeAiOhWellBid, pickAiCardToPlay, getAiBotName } from '$lib/engine/ai-bot';
	import type { RoundScore } from '$lib/components/score-table.svelte';
	import type { Card as CardType, Suit } from '$lib/types/card';
	import './app.css';

	interface PlayerBid {
		player_id: string;
		bid: number;
	}

	interface OhWellState {
		round_index: number;
		total_rounds: number;
		cards_per_player: number;
		dealer_index: number;
		trump_suit: Suit | null;
		trump_card: CardType | null;
		phase: 'bidding' | 'playing' | 'roundover' | 'gameover';
		bids: PlayerBid[];
		current_turn_index: number;
		current_trick: { player_id: string; card: CardType }[];
		completed_tricks: { player_id: string; card: CardType }[][];
		tricks_won: number[];
		scores: number[];
		cumulative_scores: number[];
	}

	interface CanadianState {
		round_index: number;
		hand_type: string;
		cards_per_player: number;
		dealer_index: number;
		phase: 'playing' | 'roundover' | 'gameover';
		current_turn_index: number;
		current_trick: { player_id: string; card: CardType }[];
		completed_tricks: { player_id: string; card: CardType }[][];
		tricks_won: number[];
		scores: number[];
		cumulative_scores: number[];
	}

	const GAME_DEFS = [
		{
			id: 'oh-well',
			name: 'Oh Well',
			minPlayers: 3,
			maxPlayers: 7,
			rules: 'Bid exactly how many tricks you will take. Trump beats led suit. Hook rule for dealer.'
		},
		{
			id: 'canadian-salad',
			name: 'Canadian Salad',
			minPlayers: 3,
			maxPlayers: 6,
			rules: 'Avoid penalty cards: No Tricks, No Hearts, No Queens, No King of Spades, No Last Trick, Combination.'
		}
	];

	// Navigation & user profile state
	let myDisplayName = $state(
		typeof window !== 'undefined'
			? localStorage.getItem('cards_player_name') || 'Player'
			: 'Player'
	);
	let myPlayerId = $state('human-player');

	// Screen Phase: 'lobby' | 'waiting-room' | 'playing'
	let currentPhase = $state<'lobby' | 'waiting-room' | 'playing'>('lobby');

	// Lobby Creation Options
	let selectedGameId = $state('oh-well');
	let targetPlayerCount = $state(4);
	let joinInput = $state('');
	let lobbyError = $state('');

	// Active Room / Swarm State
	let wasmReady = $state(false);
	let irohNode = $state<IrohNode | null>(null);
	let irohRoom = $state<any>(null);
	let roomTicket = $state('');
	let isHost = $state(true);
	let networkStatus = $state('Initializing P2P...');
	let roomPlayers = $state<LobbyPlayer[]>([]);

	// Game Engine Instances
	let ohWellEngine = $state<WasmOhWell | null>(null);
	let ohWellState = $state<OhWellState | null>(null);
	let ohWellHands = $state<CardType[][]>([]);
	let ohWellRoundHistory = $state<RoundScore[]>([]);

	let saladEngine = $state<WasmCanadianSalad | null>(null);
	let saladState = $state<CanadianState | null>(null);
	let saladHands = $state<CardType[][]>([]);
	let saladRoundHistory = $state<RoundScore[]>([]);

	let showRules = $state(false);

	// Derived helpers
	const selectedGameDef = $derived(GAME_DEFS.find((g) => g.id === selectedGameId)!);
	const playerOptions = $derived.by(() => {
		const opts: number[] = [];
		for (let n = selectedGameDef.minPlayers; n <= selectedGameDef.maxPlayers; n++) {
			opts.push(n);
		}
		return opts;
	});

	const playerNames = $derived.by(() => {
		const map: Record<string, string> = {};
		for (const p of roomPlayers) {
			map[p.id] = p.displayName;
		}
		return map;
	});

	const playerIds = $derived(roomPlayers.map((p) => p.id));
	const isRoomFull = $derived(roomPlayers.length >= targetPlayerCount);

	// Initialize WASM & Iroh node on start
	$effect(() => {
		init().then(async () => {
			wasmReady = true;
			try {
				const node = await IrohNode.spawn();
				irohNode = node;
				networkStatus = 'P2P Relay Ready';
			} catch (e: any) {
				networkStatus = 'Offline (Local Only)';
			}
		});
	});

	function handleNameChange(name: string) {
		myDisplayName = name;
		localStorage.setItem('cards_player_name', name);
		if (roomPlayers.length > 0) {
			roomPlayers[0].displayName = name;
		}
	}

	async function handleCreateRoom() {
		lobbyError = '';
		isHost = true;
		roomPlayers = [{ id: myPlayerId, displayName: myDisplayName, isHost: true }];

		if (irohNode) {
			try {
				const room = await irohNode.create_room();
				irohRoom = room;
				roomTicket = room.ticket();
				listenStream(room);
			} catch (e: any) {
				roomTicket = `LOCAL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
			}
		} else {
			roomTicket = `LOCAL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
		}

		currentPhase = 'waiting-room';
	}

	async function handleJoinRoom() {
		if (!joinInput.trim()) return;
		lobbyError = '';
		isHost = false;
		roomTicket = joinInput.trim();
		roomPlayers = [{ id: myPlayerId, displayName: myDisplayName, isHost: false }];

		if (irohNode && joinInput.startsWith('game')) {
			try {
				const room = await irohNode.join_room(joinInput.trim());
				irohRoom = room;
				listenStream(room);
			} catch (e: any) {
				lobbyError = `Failed to join Iroh room: ${e.message}`;
				return;
			}
		}

		currentPhase = 'waiting-room';
	}

	function handleAddAiBot() {
		if (isRoomFull) return;
		const aiIndex = roomPlayers.filter((p) => p.isAi).length;
		const botId = `bot-${aiIndex + 1}`;
		const botName = getAiBotName(aiIndex);
		roomPlayers = [...roomPlayers, { id: botId, displayName: botName, isAi: true }];
	}

	function handleStartGame() {
		if (!isRoomFull) return;
		const seed = Math.floor(Math.random() * 1000000);

		if (selectedGameId === 'oh-well') {
			ohWellEngine = new WasmOhWell(playerIds, seed);
			ohWellRoundHistory = [];
			syncOhWell();
		} else {
			saladEngine = new WasmCanadianSalad(playerIds, seed);
			saladRoundHistory = [];
			syncCanadianSalad();
		}

		currentPhase = 'playing';
	}

	function handleLeaveRoom() {
		currentPhase = 'lobby';
		roomPlayers = [];
		roomTicket = '';
		irohRoom = null;
		ohWellEngine = null;
		saladEngine = null;
	}

	function listenStream(room: any) {
		try {
			const stream = room.take_stream();
			const reader = stream.getReader();
			(async () => {
				while (true) {
					const { value, done } = await reader.read();
					if (done) break;
					if (value && value.type === 'message') {
						handleIncomingP2pMessage(value.payload);
					}
				}
			})();
		} catch (e) {
			console.log('Stream error', e);
		}
	}

	function handleIncomingP2pMessage(payload: string) {
		try {
			const data = JSON.parse(payload);
			if (data.type === 'move' && selectedGameId === 'oh-well' && ohWellEngine) {
				ohWellEngine.play_card(data.playerId, data.card.suit, data.card.rank);
				syncOhWell();
			}
		} catch (e) {
			console.log('Parse error', e);
		}
	}

	function syncOhWell() {
		if (!ohWellEngine) return;
		ohWellState = ohWellEngine.get_state() as OhWellState;
		ohWellHands = ohWellEngine.get_hands() as CardType[][];
	}

	function syncCanadianSalad() {
		if (!saladEngine) return;
		saladState = saladEngine.get_state() as CanadianState;
		saladHands = saladEngine.get_hands() as CardType[][];
	}

	// Automated AI Turn Trigger
	$effect(() => {
		if (currentPhase !== 'playing') return;

		if (selectedGameId === 'oh-well' && ohWellState && ohWellEngine) {
			const activeIdx = ohWellState.current_turn_index;
			const activePlayer = roomPlayers[activeIdx];
			if (!activePlayer || !activePlayer.isAi) return;

			const timer = setTimeout(() => {
				if (!ohWellState || !ohWellEngine) return;
				if (ohWellState.phase === 'bidding') {
					const bid = computeAiOhWellBid({
						hand: ohWellHands[activeIdx] ?? [],
						trumpSuit: ohWellState.trump_suit,
						cardsPerPlayer: ohWellState.cards_per_player,
						hookBid
					});
					ohWellEngine.place_bid(activePlayer.id, bid);
					syncOhWell();
				} else if (ohWellState.phase === 'playing') {
					const card = pickAiCardToPlay({
						hand: ohWellHands[activeIdx] ?? [],
						currentTrick: ohWellState.current_trick
					});
					ohWellEngine.play_card(activePlayer.id, card.suit, card.rank);
					syncOhWell();
					checkOhWellRoundEnd();
				}
			}, 600);

			return () => clearTimeout(timer);
		}

		if (selectedGameId === 'canadian-salad' && saladState && saladEngine) {
			const activeIdx = saladState.current_turn_index;
			const activePlayer = roomPlayers[activeIdx];
			if (!activePlayer || !activePlayer.isAi) return;

			const timer = setTimeout(() => {
				if (!saladState || !saladEngine) return;
				if (saladState.phase === 'playing') {
					const card = pickAiCardToPlay({
						hand: saladHands[activeIdx] ?? [],
						currentTrick: saladState.current_trick,
						gameId: 'canadian-salad'
					});
					saladEngine.play_card(activePlayer.id, card.suit, card.rank);
					syncCanadianSalad();
					checkSaladRoundEnd();
				}
			}, 600);

			return () => clearTimeout(timer);
		}
	});

	function checkOhWellRoundEnd() {
		if (ohWellState?.phase === 'roundover') {
			ohWellRoundHistory = [
				...ohWellRoundHistory,
				{
					round: ohWellState.round_index,
					label: `Round ${ohWellState.round_index + 1} (${ohWellState.cards_per_player} Cards)`,
					scores: playerIds.map((id, i) => ({
						playerId: id,
						points: ohWellState!.scores[i]
					}))
				}
			];
		}
	}

	function checkSaladRoundEnd() {
		if (saladState?.phase === 'roundover') {
			saladRoundHistory = [
				...saladRoundHistory,
				{
					round: saladState.round_index,
					label: saladState.hand_type,
					scores: playerIds.map((id, i) => ({
						playerId: id,
						points: saladState!.scores[i]
					}))
				}
			];
		}
	}

	function handleHumanOhWellBid(bid: number) {
		if (!ohWellEngine || !ohWellState) return;
		try {
			ohWellEngine.place_bid(myPlayerId, bid);
			syncOhWell();
		} catch (e: any) {
			console.error(e.message);
		}
	}

	function handleHumanOhWellPlay(card: CardType) {
		if (!ohWellEngine || !ohWellState) return;
		try {
			ohWellEngine.play_card(myPlayerId, card.suit, card.rank);
			syncOhWell();
			checkOhWellRoundEnd();
		} catch (e: any) {
			console.error(e.message);
		}
	}

	function handleHumanSaladPlay(card: CardType) {
		if (!saladEngine || !saladState) return;
		try {
			saladEngine.play_card(myPlayerId, card.suit, card.rank);
			syncCanadianSalad();
			checkSaladRoundEnd();
		} catch (e: any) {
			console.error(e.message);
		}
	}

	function handleNextRound() {
		if (selectedGameId === 'oh-well' && ohWellEngine && ohWellState) {
			ohWellEngine.start_round(ohWellState.round_index + 1);
			syncOhWell();
		} else if (selectedGameId === 'canadian-salad' && saladEngine && saladState) {
			saladEngine.start_round(saladState.round_index + 1);
			syncCanadianSalad();
		}
	}

	const hookBid = $derived.by(() => {
		if (!ohWellState || ohWellState.phase !== 'bidding') return null;
		const isDealer = ohWellState.current_turn_index === ohWellState.dealer_index;
		if (!isDealer) return null;
		const totalBids = ohWellState.bids.reduce((sum, b) => sum + b.bid, 0);
		const hook = ohWellState.cards_per_player - totalBids;
		return hook >= 0 && hook <= ohWellState.cards_per_player ? hook : null;
	});

	function formatTrick(tricks: { player_id: string; card: CardType }[]): TrickPlay[] {
		return tricks.map((t) => ({ playerId: t.player_id, card: t.card }));
	}

	function getPlayableCards(hand: CardType[], currentTrick: { card: CardType }[]): CardType[] {
		if (currentTrick.length === 0) return hand;
		const ledSuit = currentTrick[0].card.suit;
		const hasSuit = hand.some((c) => c.suit === ledSuit);
		if (hasSuit) {
			return hand.filter((c) => c.suit === ledSuit);
		}
		return hand;
	}

	const myPlayerIndex = $derived(playerIds.indexOf(myPlayerId));
	const isMyTurnOhWell = $derived(ohWellState?.current_turn_index === myPlayerIndex);
	const isMyTurnSalad = $derived(saladState?.current_turn_index === myPlayerIndex);
</script>

<div class="min-h-screen bg-background text-foreground flex flex-col">
	<NavBar
		displayName={myDisplayName}
		{networkStatus}
		onNameChange={handleNameChange}
	/>

	{#if currentPhase === 'lobby'}
		<main class="max-w-md mx-auto p-6 space-y-6 flex-1 w-full">
			{#if lobbyError}
				<p class="text-destructive text-sm bg-destructive/10 p-3 rounded-lg border border-destructive/20">{lobbyError}</p>
			{/if}

			<Card>
				<CardHeader>
					<CardTitle>Create Game</CardTitle>
				</CardHeader>
				<CardContent class="space-y-4">
					<div class="grid grid-cols-2 gap-2">
						{#each GAME_DEFS as game (game.id)}
							<button
								class="rounded-lg border-2 p-3 text-left transition-all cursor-pointer {selectedGameId === game.id
									? 'border-primary bg-primary/10'
									: 'border-border hover:border-muted-foreground'}"
								onclick={() => (selectedGameId = game.id)}
							>
								<span class="block text-sm font-semibold">{game.name}</span>
								<span class="block text-xs text-muted-foreground">
									{game.minPlayers}-{game.maxPlayers} players
								</span>
							</button>
						{/each}
					</div>

					<div class="flex items-center gap-2">
						<span class="text-sm text-muted-foreground">Players</span>
						<div class="flex gap-1">
							{#each playerOptions as n (n)}
								<button
									class="rounded-md border px-3 py-1 text-sm font-medium transition-all cursor-pointer {targetPlayerCount === n
										? 'border-primary bg-primary/10 text-primary'
										: 'border-border text-muted-foreground hover:border-muted-foreground'}"
									onclick={() => (targetPlayerCount = n)}
								>
									{n}
								</button>
							{/each}
						</div>
					</div>

					<Button class="w-full" onclick={handleCreateRoom}>
						Create Room
					</Button>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Join Game</CardTitle>
				</CardHeader>
				<CardContent class="space-y-3">
					<Input
						bind:value={joinInput}
						placeholder="Enter room ticket or code"
					/>
					<Button
						variant="secondary"
						class="w-full"
						onclick={handleJoinRoom}
						disabled={!joinInput.trim()}
					>
						Join Room
					</Button>
				</CardContent>
			</Card>
		</main>
	{:else if currentPhase === 'waiting-room'}
		<RoomLobby
			gameName={selectedGameDef.name}
			roomCode={roomTicket}
			players={roomPlayers}
			maxPlayers={targetPlayerCount}
			{isHost}
			isFull={isRoomFull}
			onStart={handleStartGame}
			onLeave={handleLeaveRoom}
			onAddAi={handleAddAiBot}
		/>
	{:else if currentPhase === 'playing'}
		{#if selectedGameId === 'oh-well' && ohWellState}
			<!-- Game Table Top Navigation -->
			<nav class="border-b border-border px-4 py-2 flex justify-between items-center gap-2">
				<div class="flex items-center gap-2">
					<Button variant="ghost" size="sm" class="h-7 text-xs text-muted-foreground hover:text-foreground" onclick={handleLeaveRoom}>
						← Lobby
					</Button>
					<button class="cursor-pointer" onclick={() => (showRules = !showRules)}>
						<Badge variant="outline" class="text-xs">
							Round {ohWellState.round_index + 1}/{ohWellState.total_rounds}: {ohWellState.cards_per_player} Cards
						</Badge>
					</button>
				</div>
				<div>
					{#if isMyTurnOhWell}
						<Badge variant="success" class="text-xs">Your Turn</Badge>
					{:else}
						<Badge variant="secondary" class="text-xs">
							Waiting for {playerNames[playerIds[ohWellState.current_turn_index]]}...
						</Badge>
					{/if}
				</div>
			</nav>

			{#if showRules}
				<div class="bg-muted/50 border-b border-border px-4 py-2 text-xs text-muted-foreground">
					{selectedGameDef.rules}
				</div>
			{/if}

			<OhWellTrumpBanner trumpSuit={ohWellState.trump_suit} trumpCard={ohWellState.trump_card} />

			<main class="flex-1 flex flex-col justify-between p-2 max-w-4xl mx-auto w-full">
				<!-- Table Seating Area -->
				<div class="flex flex-wrap justify-center gap-x-5 gap-y-2 px-2 py-2">
					{#each playerIds as id, i (id)}
						{@const isTurn = ohWellState.current_turn_index === i}
						{@const isDealer = ohWellState.dealer_index === i}
						{@const bid = ohWellState.bids.find((b) => b.player_id === id)?.bid}
						{@const won = ohWellState.tricks_won[i]}
						{@const total = ohWellState.cumulative_scores[i]}
						<div
							class="flex flex-col items-center min-w-[70px] rounded-md px-2 py-1 border transition-all"
							class:border-primary={isTurn}
							class:bg-primary-5={isTurn}
							class:border-border={!isTurn}
						>
							<span class="flex items-center gap-1 text-xs font-semibold" class:text-success={isTurn}>
								{playerNames[id]}
								{#if isDealer}<span title="Dealer">👑</span>{/if}
							</span>
							<span class="text-[10px] text-muted-foreground font-mono">
								Bid: {bid ?? '-'}/Won: {won}
							</span>
							<span class="text-[10px] text-accent font-bold font-mono">
								{total} pts
							</span>
						</div>
					{/each}
				</div>

				<!-- Center Trick Area -->
				<div class="my-auto">
					<TrickArea
						plays={formatTrick(ohWellState.current_trick)}
						lastCompleteTrick={formatTrick(ohWellState.completed_tricks.at(-1) ?? [])}
						{playerNames}
						gameId="oh-well"
						trumpSuit={ohWellState.trump_suit}
					/>
					<LastTrick
						plays={formatTrick(ohWellState.completed_tricks.at(-1) ?? [])}
						winnerName={null}
					/>
				</div>

				<!-- Bottom Hand Display -->
				<div class="border-t border-border pt-2">
					<div class="flex justify-between items-center px-4 pb-1 text-xs">
						<span class="text-muted-foreground font-medium">
							Your Hand ({myDisplayName})
						</span>
						<span class="text-muted-foreground font-mono text-[11px]">
							{ohWellHands[myPlayerIndex]?.length ?? 0} cards
						</span>
					</div>
					<HandDisplay
						cards={ohWellHands[myPlayerIndex] ?? []}
						playableCards={isMyTurnOhWell && ohWellState.phase === 'playing'
							? getPlayableCards(ohWellHands[myPlayerIndex] ?? [], ohWellState.current_trick)
							: []}
						gameId="oh-well"
						trumpSuit={ohWellState.trump_suit}
						onCardPlayed={handleHumanOhWellPlay}
					/>
				</div>
			</main>

			<!-- Human Bidding Modal -->
			{#if ohWellState.phase === 'bidding' && isMyTurnOhWell}
				<OhWellBidding
					cardsPerPlayer={ohWellState.cards_per_player}
					trumpSuit={ohWellState.trump_suit}
					myHand={ohWellHands[myPlayerIndex] ?? []}
					{playerNames}
					existingBids={ohWellState.bids}
					{hookBid}
					isMyTurn={true}
					currentBidderName={myDisplayName}
					onBid={handleHumanOhWellBid}
				/>
			{/if}

			<!-- Round Over Overlay -->
			{#if ohWellState.phase === 'roundover'}
				<RoundScoreOverlay
					handLabel={`Round ${ohWellState.round_index + 1} (${ohWellState.cards_per_player} Cards)`}
					scores={playerIds.map((id, i) => ({
						playerId: id,
						points: ohWellState!.scores[i]
					}))}
					{playerNames}
					onContinue={handleNextRound}
				/>
			{/if}

			<!-- Game Over Overlay -->
			{#if ohWellState.phase === 'gameover'}
				<GameOverOverlay
					{playerNames}
					{playerIds}
					rounds={ohWellRoundHistory}
					onRestart={handleLeaveRoom}
				/>
			{/if}
		{:else if selectedGameId === 'canadian-salad' && saladState}
			<!-- Game Table Top Navigation -->
			<nav class="border-b border-border px-4 py-2 flex justify-between items-center gap-2">
				<div class="flex items-center gap-2">
					<Button variant="ghost" size="sm" class="h-7 text-xs text-muted-foreground hover:text-foreground" onclick={handleLeaveRoom}>
						← Lobby
					</Button>
					<button class="cursor-pointer" onclick={() => (showRules = !showRules)}>
						<Badge variant="outline" class="text-xs">
							Hand {saladState.round_index + 1}/6: {saladState.hand_type}
						</Badge>
					</button>
				</div>
				<div>
					{#if isMyTurnSalad}
						<Badge variant="success" class="text-xs">Your Turn</Badge>
					{:else}
						<Badge variant="secondary" class="text-xs">
							Waiting for {playerNames[playerIds[saladState.current_turn_index]]}...
						</Badge>
					{/if}
				</div>
			</nav>

			{#if showRules}
				<div class="bg-muted/50 border-b border-border px-4 py-2 text-xs text-muted-foreground">
					{selectedGameDef.rules}
				</div>
			{/if}

			<CanadianSaladPenalties handType={saladState.hand_type} />

			<main class="flex-1 flex flex-col justify-between p-2 max-w-4xl mx-auto w-full">
				<!-- Table Seating Area -->
				<div class="flex flex-wrap justify-center gap-x-5 gap-y-2 px-2 py-2">
					{#each playerIds as id, i (id)}
						{@const isTurn = saladState.current_turn_index === i}
						{@const isDealer = saladState.dealer_index === i}
						{@const won = saladState.tricks_won[i]}
						{@const total = saladState.cumulative_scores[i]}
						<div
							class="flex flex-col items-center min-w-[70px] rounded-md px-2 py-1 border transition-all"
							class:border-primary={isTurn}
							class:bg-primary-5={isTurn}
							class:border-border={!isTurn}
						>
							<span class="flex items-center gap-1 text-xs font-semibold" class:text-success={isTurn}>
								{playerNames[id]}
								{#if isDealer}<span title="Dealer">👑</span>{/if}
							</span>
							<span class="text-[10px] text-muted-foreground font-mono">
								Tricks: {won}
							</span>
							<span class="text-[10px] text-destructive font-bold font-mono">
								{total} pts
							</span>
						</div>
					{/each}
				</div>

				<!-- Center Trick Area -->
				<div class="my-auto">
					<TrickArea
						plays={formatTrick(saladState.current_trick)}
						lastCompleteTrick={formatTrick(saladState.completed_tricks.at(-1) ?? [])}
						{playerNames}
						gameId="canadian-salad"
						handType={saladState.hand_type}
					/>
					<LastTrick
						plays={formatTrick(saladState.completed_tricks.at(-1) ?? [])}
						winnerName={null}
					/>
				</div>

				<!-- Bottom Hand Display -->
				<div class="border-t border-border pt-2">
					<div class="flex justify-between items-center px-4 pb-1 text-xs">
						<span class="text-muted-foreground font-medium">
							Your Hand ({myDisplayName})
						</span>
						<span class="text-muted-foreground font-mono text-[11px]">
							{saladHands[myPlayerIndex]?.length ?? 0} cards
						</span>
					</div>
					<HandDisplay
						cards={saladHands[myPlayerIndex] ?? []}
						playableCards={isMyTurnSalad && saladState.phase === 'playing'
							? getPlayableCards(saladHands[myPlayerIndex] ?? [], saladState.current_trick)
							: []}
						gameId="canadian-salad"
						handType={saladState.hand_type}
						onCardPlayed={handleHumanSaladPlay}
					/>
				</div>
			</main>

			<!-- Round Over Overlay -->
			{#if saladState.phase === 'roundover'}
				<RoundScoreOverlay
					handLabel={`Round ${saladState.round_index + 1}: ${saladState.hand_type}`}
					scores={playerIds.map((id, i) => ({
						playerId: id,
						points: saladState!.scores[i]
					}))}
					{playerNames}
					onContinue={handleNextRound}
				/>
			{/if}

			<!-- Game Over Overlay -->
			{#if saladState.phase === 'gameover'}
				<GameOverOverlay
					{playerNames}
					{playerIds}
					rounds={saladRoundHistory}
					onRestart={handleLeaveRoom}
				/>
			{/if}
		{/if}
	{/if}
</div>
