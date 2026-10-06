<script lang="ts">
	import init, { IrohNode, WasmOhWell, WasmCanadianSalad } from './wasm/cards_wasm.js';
	import { Button } from '$lib/components/ui/button/index';
	import { Badge } from '$lib/components/ui/badge/index';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card/index';
	import HandDisplay from '$lib/components/hand-display.svelte';
	import TrickArea, { type TrickPlay } from '$lib/components/trick-area.svelte';
	import LastTrick from '$lib/components/last-trick.svelte';
	import CanadianSaladPenalties from '$lib/components/canadian-salad-penalties.svelte';
	import OhWellTrumpBanner from '$lib/components/oh-well-trump-banner.svelte';
	import OhWellBidding from '$lib/components/oh-well-bidding.svelte';
	import RoundScoreOverlay from '$lib/components/round-score-overlay.svelte';
	import GameOverOverlay from '$lib/components/game-over-overlay.svelte';
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

	let wasmReady = $state(false);
	let activeTab = $state<'oh-well' | 'canadian-salad' | 'iroh'>('oh-well');

	const playerNames: Record<string, string> = {
		alice: 'Alice',
		bob: 'Bob',
		carol: 'Carol',
		dave: 'Dave'
	};
	const playerIds = ['alice', 'bob', 'carol', 'dave'];

	// Oh Well state
	let ohWellEngine = $state<WasmOhWell | null>(null);
	let ohWellState = $state<OhWellState | null>(null);
	let ohWellHands = $state<CardType[][]>([]);
	let ohWellRoundHistory = $state<RoundScore[]>([]);

	// Canadian Salad state
	let saladEngine = $state<WasmCanadianSalad | null>(null);
	let saladState = $state<CanadianState | null>(null);
	let saladHands = $state<CardType[][]>([]);
	let saladRoundHistory = $state<RoundScore[]>([]);

	// Iroh state
	let irohNode = $state<IrohNode | null>(null);
	let endpointId = $state<string>('');
	let currentTicket = $state<string>('');
	let joinTicketInput = $state<string>('');
	let irohRoom = $state<any>(null);
	let networkStatus = $state<string>('Not initialized');
	let networkMessages = $state<{ from: string; payload: string }[]>([]);
	let broadcastMsg = $state<string>('{"type":"ping","message":"Hello from Cards Iroh!"}');
	let copied = $state(false);

	$effect(() => {
		init().then(() => {
			wasmReady = true;
			resetOhWell();
			resetCanadianSalad();
		});
	});

	function resetOhWell() {
		const seed = Math.floor(Math.random() * 1000000);
		ohWellEngine = new WasmOhWell(playerIds, seed);
		ohWellRoundHistory = [];
		syncOhWell();
	}

	function syncOhWell() {
		if (!ohWellEngine) return;
		ohWellState = ohWellEngine.get_state() as OhWellState;
		ohWellHands = ohWellEngine.get_hands() as CardType[][];
	}

	function resetCanadianSalad() {
		const seed = Math.floor(Math.random() * 1000000);
		saladEngine = new WasmCanadianSalad(playerIds, seed);
		saladRoundHistory = [];
		syncCanadianSalad();
	}

	function syncCanadianSalad() {
		if (!saladEngine) return;
		saladState = saladEngine.get_state() as CanadianState;
		saladHands = saladEngine.get_hands() as CardType[][];
	}

	function handleOhWellBid(bid: number) {
		if (!ohWellEngine || !ohWellState) return;
		const activeId = playerIds[ohWellState.current_turn_index];
		try {
			ohWellEngine.place_bid(activeId, bid);
			syncOhWell();
		} catch (e: any) {
			console.error(e.message);
		}
	}

	function handleOhWellPlay(card: CardType) {
		if (!ohWellEngine || !ohWellState) return;
		const activeId = playerIds[ohWellState.current_turn_index];
		try {
			ohWellEngine.play_card(activeId, card.suit, card.rank);
			syncOhWell();

			if (ohWellState.phase === 'roundover') {
				ohWellRoundHistory = [
					...ohWellRoundHistory,
					{
						round: ohWellState.round_index,
						label: `Round ${ohWellState.round_index + 1} (${ohWellState.cards_per_player} cards)`,
						scores: playerIds.map((id, i) => ({
							playerId: id,
							points: ohWellState!.scores[i]
						}))
					}
				];
			}
		} catch (e: any) {
			console.error(e.message);
		}
	}

	function handleNextOhWellRound() {
		if (!ohWellEngine || !ohWellState) return;
		ohWellEngine.start_round(ohWellState.round_index + 1);
		syncOhWell();
	}

	function handleSaladPlay(card: CardType) {
		if (!saladEngine || !saladState) return;
		const activeId = playerIds[saladState.current_turn_index];
		try {
			saladEngine.play_card(activeId, card.suit, card.rank);
			syncCanadianSalad();

			if (saladState.phase === 'roundover') {
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
		} catch (e: any) {
			console.error(e.message);
		}
	}

	function handleNextSaladRound() {
		if (!saladEngine || !saladState) return;
		saladEngine.start_round(saladState.round_index + 1);
		syncCanadianSalad();
	}

	// Calculate hook bid for Oh Well dealer
	const hookBid = $derived.by(() => {
		if (!ohWellState || ohWellState.phase !== 'bidding') return null;
		const isDealer = ohWellState.current_turn_index === ohWellState.dealer_index;
		if (!isDealer) return null;
		const totalBids = ohWellState.bids.reduce((sum, b) => sum + b.bid, 0);
		const hook = ohWellState.cards_per_player - totalBids;
		return hook >= 0 && hook <= ohWellState.cards_per_player ? hook : null;
	});

	// Trick formatting
	function formatTrick(tricks: { player_id: string; card: CardType }[]): TrickPlay[] {
		return tricks.map((t) => ({ playerId: t.player_id, card: t.card }));
	}

	// Playable cards calculation
	function getPlayableCards(hand: CardType[], currentTrick: { card: CardType }[]): CardType[] {
		if (currentTrick.length === 0) return hand;
		const ledSuit = currentTrick[0].card.suit;
		const hasSuit = hand.some((c) => c.suit === ledSuit);
		if (hasSuit) {
			return hand.filter((c) => c.suit === ledSuit);
		}
		return hand;
	}

	// Iroh functions
	async function initIroh() {
		if (!wasmReady) return;
		networkStatus = 'Binding to Iroh public relay...';
		try {
			const node = await IrohNode.spawn();
			irohNode = node;
			endpointId = node.endpoint_id();
			networkStatus = 'Iroh Node active and connected';
		} catch (e: any) {
			networkStatus = `Error: ${e.message}`;
		}
	}

	async function createIrohRoom() {
		if (!irohNode) return;
		networkStatus = 'Creating encrypted topic overlay...';
		try {
			const room = await irohNode.create_room();
			irohRoom = room;
			currentTicket = room.ticket();
			networkStatus = `Room active! Topic: ${room.topic_id().slice(0, 12)}...`;
			listenStream(room);
		} catch (e: any) {
			networkStatus = `Error: ${e.message}`;
		}
	}

	async function joinIrohRoom() {
		if (!irohNode || !joinTicketInput) return;
		networkStatus = 'Joining room overlay...';
		try {
			const room = await irohNode.join_room(joinTicketInput.trim());
			irohRoom = room;
			currentTicket = joinTicketInput.trim();
			networkStatus = `Joined room! Topic: ${room.topic_id().slice(0, 12)}...`;
			listenStream(room);
		} catch (e: any) {
			networkStatus = `Error: ${e.message}`;
		}
	}

	async function listenStream(room: any) {
		try {
			const stream = room.take_stream();
			const reader = stream.getReader();
			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				if (value && value.type === 'message') {
					networkMessages = [...networkMessages, { from: value.from, payload: value.payload }];
				}
			}
		} catch (e: any) {
			console.log('Stream ended', e);
		}
	}

	async function broadcastIrohMsg() {
		if (!irohRoom) return;
		try {
			await irohRoom.broadcast(broadcastMsg);
		} catch (e: any) {
			networkStatus = `Broadcast failed: ${e.message}`;
		}
	}

	function copyTicket() {
		navigator.clipboard.writeText(currentTicket);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<div class="min-h-screen bg-background text-foreground flex flex-col">
	<nav class="border-b border-border px-4 py-2 flex justify-between items-center gap-2">
		<div class="flex items-center gap-3">
			<h1 class="text-sm font-bold tracking-tight">Cards &middot; Iroh P2P</h1>
			<div class="flex gap-1">
				<Button
					variant={activeTab === 'oh-well' ? 'default' : 'ghost'}
					size="sm"
					class="h-7 text-xs px-2"
					onclick={() => (activeTab = 'oh-well')}
				>
					Oh Well
				</Button>
				<Button
					variant={activeTab === 'canadian-salad' ? 'default' : 'ghost'}
					size="sm"
					class="h-7 text-xs px-2"
					onclick={() => (activeTab = 'canadian-salad')}
				>
					Canadian Salad
				</Button>
				<Button
					variant={activeTab === 'iroh' ? 'default' : 'ghost'}
					size="sm"
					class="h-7 text-xs px-2"
					onclick={() => (activeTab = 'iroh')}
				>
					Iroh Swarm
				</Button>
			</div>
		</div>

		<div>
			{#if activeTab === 'oh-well' && ohWellState}
				<Badge variant="outline" class="text-xs">
					Hand {ohWellState.round_index + 1}/{ohWellState.total_rounds}: {ohWellState.cards_per_player} Cards
				</Badge>
			{:else if activeTab === 'canadian-salad' && saladState}
				<Badge variant="outline" class="text-xs">
					Hand {saladState.round_index + 1}/6: {saladState.hand_type}
				</Badge>
			{/if}
		</div>
	</nav>

	{#if !wasmReady}
		<div class="flex-1 flex items-center justify-center">
			<p class="text-muted-foreground animate-pulse text-sm">Loading Rust WASM Game Engine...</p>
		</div>
	{:else if activeTab === 'oh-well' && ohWellState}
		<OhWellTrumpBanner trumpSuit={ohWellState.trump_suit} trumpCard={ohWellState.trump_card} />

		<main class="flex-1 flex flex-col justify-between p-2 max-w-4xl mx-auto w-full">
			<!-- Table Seating Area -->
			<div class="flex flex-wrap justify-center gap-x-6 gap-y-2 px-2 py-2">
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
						Playing as: <strong class="text-foreground">{playerNames[playerIds[ohWellState.current_turn_index]]}</strong>
					</span>
					<span class="text-muted-foreground font-mono text-[11px]">
						Round {ohWellState.round_index + 1}
					</span>
				</div>
				<HandDisplay
					cards={ohWellHands[ohWellState.current_turn_index] ?? []}
					playableCards={ohWellState.phase === 'playing'
						? getPlayableCards(
								ohWellHands[ohWellState.current_turn_index] ?? [],
								ohWellState.current_trick
							)
						: []}
					gameId="oh-well"
					trumpSuit={ohWellState.trump_suit}
					onCardPlayed={handleOhWellPlay}
				/>
			</div>
		</main>

		<!-- Bidding Overlay -->
		{#if ohWellState.phase === 'bidding'}
			<OhWellBidding
				cardsPerPlayer={ohWellState.cards_per_player}
				trumpSuit={ohWellState.trump_suit}
				myHand={ohWellHands[ohWellState.current_turn_index] ?? []}
				{playerNames}
				existingBids={ohWellState.bids}
				{hookBid}
				isMyTurn={true}
				currentBidderName={playerNames[playerIds[ohWellState.current_turn_index]]}
				onBid={handleOhWellBid}
			/>
		{/if}

		<!-- Round Over Results Overlay -->
		{#if ohWellState.phase === 'roundover'}
			<RoundScoreOverlay
				handLabel={`Round ${ohWellState.round_index + 1} (${ohWellState.cards_per_player} Cards)`}
				scores={playerIds.map((id, i) => ({
					playerId: id,
					points: ohWellState!.scores[i]
				}))}
				{playerNames}
				onContinue={handleNextOhWellRound}
			/>
		{/if}

		<!-- Game Over Overlay -->
		{#if ohWellState.phase === 'gameover'}
			<GameOverOverlay
				{playerNames}
				{playerIds}
				rounds={ohWellRoundHistory}
				onRestart={resetOhWell}
			/>
		{/if}
	{:else if activeTab === 'canadian-salad' && saladState}
		<CanadianSaladPenalties handType={saladState.hand_type} />

		<main class="flex-1 flex flex-col justify-between p-2 max-w-4xl mx-auto w-full">
			<!-- Table Seating Area -->
			<div class="flex flex-wrap justify-center gap-x-6 gap-y-2 px-2 py-2">
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
						Playing as: <strong class="text-foreground">{playerNames[playerIds[saladState.current_turn_index]]}</strong>
					</span>
					<span class="text-muted-foreground font-mono text-[11px]">
						{saladState.hand_type}
					</span>
				</div>
				<HandDisplay
					cards={saladHands[saladState.current_turn_index] ?? []}
					playableCards={saladState.phase === 'playing'
						? getPlayableCards(
								saladHands[saladState.current_turn_index] ?? [],
								saladState.current_trick
							)
						: []}
					gameId="canadian-salad"
					handType={saladState.hand_type}
					onCardPlayed={handleSaladPlay}
				/>
			</div>
		</main>

		<!-- Round Over Results Overlay -->
		{#if saladState.phase === 'roundover'}
			<RoundScoreOverlay
				handLabel={`Round ${saladState.round_index + 1}: ${saladState.hand_type}`}
				scores={playerIds.map((id, i) => ({
					playerId: id,
					points: saladState!.scores[i]
				}))}
				{playerNames}
				onContinue={handleNextSaladRound}
			/>
		{/if}

		<!-- Game Over Overlay -->
		{#if saladState.phase === 'gameover'}
			<GameOverOverlay
				{playerNames}
				{playerIds}
				rounds={saladRoundHistory}
				onRestart={resetCanadianSalad}
			/>
		{/if}
	{:else if activeTab === 'iroh'}
		<div class="max-w-2xl mx-auto p-4 w-full">
			<Card>
				<CardHeader>
					<CardTitle>Iroh P2P Gossip Swarm</CardTitle>
					<p class="text-sm text-muted-foreground">
						Zero-database serverless networking running directly in your browser via WebAssembly and public relay.
					</p>
				</CardHeader>
				<CardContent class="space-y-4">
					<div class="p-3 bg-muted/40 rounded-lg border text-xs space-y-1">
						<div class="font-semibold text-primary">{networkStatus}</div>
						{#if endpointId}
							<div class="text-muted-foreground break-all font-mono text-[11px]">
								Endpoint ID: {endpointId}
							</div>
						{/if}
					</div>

					{#if !irohNode}
						<Button onclick={initIroh} class="w-full">
							Initialize Iroh Node
						</Button>
					{:else}
						<div class="flex gap-2">
							<Button variant="default" onclick={createIrohRoom}>
								Create Room
							</Button>
							<input
								type="text"
								placeholder="Paste room ticket..."
								bind:value={joinTicketInput}
								class="flex-1 px-3 py-1.5 rounded-md border bg-background text-xs font-mono"
							/>
							<Button variant="secondary" onclick={joinIrohRoom}>
								Join
							</Button>
						</div>

						{#if currentTicket}
							<div class="space-y-1 p-3 bg-muted/20 border rounded-lg">
								<div class="flex justify-between items-center text-xs">
									<span class="text-muted-foreground font-medium">Room Ticket:</span>
									<Button variant="outline" size="sm" class="h-6 text-[10px]" onclick={copyTicket}>
										{copied ? 'Copied!' : 'Copy Ticket'}
									</Button>
								</div>
								<textarea
									readonly
									rows="2"
									class="w-full p-2 text-[10px] font-mono bg-background border rounded resize-none text-emerald-400"
								>{currentTicket}</textarea>
							</div>
						{/if}

						{#if irohRoom}
							<div class="space-y-2 pt-2 border-t">
								<div class="flex gap-2">
									<input
										type="text"
										bind:value={broadcastMsg}
										class="flex-1 px-3 py-1.5 rounded-md border bg-background text-xs font-mono"
									/>
									<Button size="sm" onclick={broadcastIrohMsg}>
										Broadcast
									</Button>
								</div>

								<div class="space-y-1">
									<p class="text-xs font-semibold text-muted-foreground">Received Messages:</p>
									<div class="max-h-40 overflow-y-auto p-2 bg-background border rounded-md text-xs font-mono space-y-1">
										{#if networkMessages.length === 0}
											<span class="text-muted-foreground italic text-[11px]">No messages yet</span>
										{:else}
											{#each networkMessages as msg}
												<div class="text-[11px] pb-1 border-b border-border/20">
													<strong class="text-primary">{msg.from.slice(0, 8)}...:</strong> {msg.payload}
												</div>
											{/each}
										{/if}
									</div>
								</div>
							</div>
						{/if}
					{/if}
				</CardContent>
			</Card>
		</div>
	{/if}
</div>
