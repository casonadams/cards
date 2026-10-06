<script lang="ts">
  import init, { IrohNode, WasmOhWell, WasmCanadianSalad } from './wasm/cards_wasm.js';

  interface Card {
    suit: 'clubs' | 'diamonds' | 'hearts' | 'spades';
    rank: number;
  }

  interface TrickPlay {
    player_id: string;
    card: Card;
  }

  interface PlayerBid {
    player_id: string;
    bid: number;
  }

  interface OhWellState {
    round_index: number;
    total_rounds: number;
    cards_per_player: number;
    dealer_index: number;
    trump_suit: string | null;
    trump_card: Card | null;
    phase: 'bidding' | 'playing' | 'roundover' | 'gameover';
    bids: PlayerBid[];
    current_turn_index: number;
    current_trick: TrickPlay[];
    completed_tricks: TrickPlay[][];
    tricks_won: number[];
    scores: number[];
    cumulative_scores: number[];
  }

  let wasmReady = $state(false);
  let activeTab = $state<'oh-well' | 'salad' | 'iroh'>('oh-well');

  // Iroh state
  let irohNode = $state<IrohNode | null>(null);
  let endpointId = $state<string>('');
  let currentTicket = $state<string>('');
  let joinTicketInput = $state<string>('');
  let irohRoom = $state<any>(null);
  let networkStatus = $state<string>('Not initialized');
  let networkMessages = $state<{ from: string; payload: string }[]>([]);
  let broadcastMsg = $state<string>('{"type":"ping","hello":"from iroh!"}');

  // Oh Well state
  let ohWellEngine = $state<WasmOhWell | null>(null);
  let ohWellState = $state<OhWellState | null>(null);
  let ohWellHands = $state<Card[][]>([]);
  let ohWellPlayers = ['Alice', 'Bob', 'Carol', 'Dave'];
  let bidInput = $state<number>(0);
  let gameError = $state<string>('');

  $effect(() => {
    init().then(() => {
      wasmReady = true;
      resetOhWell();
    });
  });

  function resetOhWell() {
    try {
      gameError = '';
      const seed = Math.floor(Math.random() * 1000000);
      ohWellEngine = new WasmOhWell(ohWellPlayers, seed);
      updateOhWell();
    } catch (e: any) {
      gameError = e.message;
    }
  }

  function updateOhWell() {
    if (!ohWellEngine) return;
    ohWellState = ohWellEngine.get_state() as OhWellState;
    ohWellHands = ohWellEngine.get_hands() as Card[][];
  }

  function handleBid() {
    if (!ohWellEngine || !ohWellState) return;
    gameError = '';
    const activePlayer = ohWellPlayers[ohWellState.current_turn_index];
    try {
      ohWellEngine.place_bid(activePlayer, bidInput);
      updateOhWell();
    } catch (e: any) {
      gameError = e.message;
    }
  }

  function handlePlayCard(card: Card) {
    if (!ohWellEngine || !ohWellState) return;
    gameError = '';
    const activePlayer = ohWellPlayers[ohWellState.current_turn_index];
    try {
      ohWellEngine.play_card(activePlayer, card.suit, card.rank);
      updateOhWell();
    } catch (e: any) {
      gameError = e.message;
    }
  }

  async function initIroh() {
    if (!wasmReady) return;
    networkStatus = 'Initializing Iroh Endpoint...';
    try {
      const node = await IrohNode.spawn();
      irohNode = node;
      endpointId = node.endpoint_id();
      networkStatus = 'Iroh Endpoint active and bound to public relay';
    } catch (e: any) {
      networkStatus = `Error starting node: ${e.message}`;
    }
  }

  async function createIrohRoom() {
    if (!irohNode) return;
    networkStatus = 'Creating gossip topic...';
    try {
      const room = await irohNode.create_room();
      irohRoom = room;
      currentTicket = room.ticket();
      networkStatus = `Room created! Topic: ${room.topic_id().slice(0, 16)}...`;
      startListening(room);
    } catch (e: any) {
      networkStatus = `Error creating room: ${e.message}`;
    }
  }

  async function joinIrohRoom() {
    if (!irohNode || !joinTicketInput) return;
    networkStatus = 'Joining gossip topic via ticket...';
    try {
      const room = await irohNode.join_room(joinTicketInput.trim());
      irohRoom = room;
      currentTicket = joinTicketInput.trim();
      networkStatus = `Joined room! Topic: ${room.topic_id().slice(0, 16)}...`;
      startListening(room);
    } catch (e: any) {
      networkStatus = `Error joining room: ${e.message}`;
    }
  }

  async function startListening(room: any) {
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
      console.log('Stream error / closed', e);
    }
  }

  async function broadcastMessage() {
    if (!irohRoom) return;
    try {
      await irohRoom.broadcast(broadcastMsg);
    } catch (e: any) {
      networkStatus = `Broadcast error: ${e.message}`;
    }
  }

  const rankNames: Record<number, string> = {
    11: 'J',
    12: 'Q',
    13: 'K',
    14: 'A',
  };

  const suitSymbols: Record<string, string> = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠',
  };

  const suitColors: Record<string, string> = {
    hearts: '#ef4444',
    diamonds: '#38bdf8',
    clubs: '#22c55e',
    spades: '#e2e8f0',
  };
</script>

<header style="background: var(--card-bg); padding: 1rem 2rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
  <div>
    <h1 style="font-size: 1.25rem; font-weight: bold; color: var(--primary);">Cards &middot; Iroh + Rust WASM</h1>
    <p style="font-size: 0.85rem; color: var(--muted);">100% Free Zero-Database P2P Card Engine</p>
  </div>
  <nav style="display: flex; gap: 0.5rem;">
    <button
      style="padding: 0.5rem 1rem; border-radius: 6px; border: 1px solid var(--border); background: {activeTab === 'oh-well' ? 'var(--primary)' : 'transparent'}; color: {activeTab === 'oh-well' ? '#0f172a' : 'var(--text)'}; cursor: pointer;"
      onclick={() => (activeTab = 'oh-well')}
    >
      Oh Well Engine
    </button>
    <button
      style="padding: 0.5rem 1rem; border-radius: 6px; border: 1px solid var(--border); background: {activeTab === 'iroh' ? 'var(--primary)' : 'transparent'}; color: {activeTab === 'iroh' ? '#0f172a' : 'var(--text)'}; cursor: pointer;"
      onclick={() => (activeTab = 'iroh')}
    >
      Iroh P2P Networking
    </button>
  </nav>
</header>

<main style="max-width: 1000px; margin: 2rem auto; padding: 0 1rem; width: 100%;">
  {#if !wasmReady}
    <div style="text-align: center; padding: 4rem; color: var(--muted);">
      Loading Rust WASM Module...
    </div>
  {:else if activeTab === 'oh-well'}
    {#if gameError}
      <div style="background: rgba(239, 68, 68, 0.2); border: 1px solid var(--danger); padding: 0.75rem 1rem; border-radius: 6px; margin-bottom: 1rem; color: #fca5a5;">
        {gameError}
      </div>
    {/if}

    {#if ohWellState}
      <div style="background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <div>
            <h2 style="font-size: 1.1rem; font-weight: bold;">Round {ohWellState.round_index + 1} of {ohWellState.total_rounds}</h2>
            <p style="color: var(--muted); font-size: 0.9rem;">
              Cards this round: <strong>{ohWellState.cards_per_player}</strong> |
              Dealer: <strong>{ohWellPlayers[ohWellState.dealer_index]}</strong> |
              Trump Suit:
              {#if ohWellState.trump_suit}
                <strong style="color: {suitColors[ohWellState.trump_suit]}">{suitSymbols[ohWellState.trump_suit]} {ohWellState.trump_suit}</strong>
              {:else}
                <em>None</em>
              {/if}
            </p>
          </div>
          <div>
            <span style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; background: rgba(56, 189, 248, 0.15); color: var(--primary); font-size: 0.85rem; font-weight: 600;">
              Phase: {ohWellState.phase.toUpperCase()}
            </span>
          </div>
        </div>

        <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
          {#each ohWellPlayers as player, i}
            <div style="flex: 1; padding: 0.75rem; border: 1px solid {ohWellState.current_turn_index === i ? 'var(--primary)' : 'var(--border)'}; border-radius: 6px; background: {ohWellState.current_turn_index === i ? 'rgba(56, 189, 248, 0.05)' : 'transparent'};">
              <div style="font-weight: bold; font-size: 0.95rem;">{player} {ohWellState.dealer_index === i ? '👑' : ''}</div>
              <div style="font-size: 0.85rem; color: var(--muted);">
                Bid: {ohWellState.bids.find(b => b.player_id === player)?.bid ?? '-'} | Won: {ohWellState.tricks_won[i]}
              </div>
              <div style="font-size: 0.85rem; color: var(--accent);">Score: {ohWellState.cumulative_scores[i]}</div>
            </div>
          {/each}
        </div>

        <!-- Bidding action -->
        {#if ohWellState.phase === 'bidding'}
          <div style="padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 6px; display: flex; align-items: center; gap: 1rem;">
            <span>{ohWellPlayers[ohWellState.current_turn_index]}'s Turn to Bid (0 to {ohWellState.cards_per_player}):</span>
            <input
              type="number"
              min="0"
              max={ohWellState.cards_per_player}
              bind:value={bidInput}
              style="width: 70px; padding: 0.4rem; background: var(--bg); border: 1px solid var(--border); color: var(--text); border-radius: 4px;"
            />
            <button
              style="padding: 0.4rem 1rem; background: var(--primary); color: #0f172a; font-weight: 600; border: none; border-radius: 4px; cursor: pointer;"
              onclick={handleBid}
            >
              Submit Bid
            </button>
          </div>
        {/if}

        <!-- Current Trick -->
        <div style="margin-top: 1.5rem;">
          <h3 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 0.5rem;">Current Trick ({ohWellState.current_trick.length} of {ohWellPlayers.length} played):</h3>
          <div style="display: flex; gap: 0.5rem; min-height: 70px; align-items: center;">
            {#if ohWellState.current_trick.length === 0}
              <span style="color: var(--muted); font-size: 0.9rem;">Waiting for lead card...</span>
            {:else}
              {#each ohWellState.current_trick as play}
                <div style="padding: 0.5rem 1rem; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; text-align: center;">
                  <div style="font-size: 0.75rem; color: var(--muted);">{play.player_id}</div>
                  <div style="font-size: 1.1rem; font-weight: bold; color: {suitColors[play.card.suit]};">
                    {rankNames[play.card.rank] ?? play.card.rank}{suitSymbols[play.card.suit]}
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      </div>

      <!-- Active player hand -->
      <div style="background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 1.5rem;">
        <h3 style="font-size: 1rem; font-weight: bold; margin-bottom: 1rem;">
          Active Player Hand: {ohWellPlayers[ohWellState.current_turn_index]}
        </h3>
        <div style="display: flex; flex-wrap: wrap; gap: 0.75rem;">
          {#each ohWellHands[ohWellState.current_turn_index] ?? [] as card}
            <button
              style="padding: 0.75rem 1rem; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; cursor: {ohWellState.phase === 'playing' ? 'pointer' : 'default'}; text-align: center; min-width: 60px;"
              disabled={ohWellState.phase !== 'playing'}
              onclick={() => handlePlayCard(card)}
            >
              <div style="font-size: 1.25rem; font-weight: bold; color: {suitColors[card.suit]};">
                {rankNames[card.rank] ?? card.rank}{suitSymbols[card.suit]}
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  {:else if activeTab === 'iroh'}
    <div style="background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 1.5rem;">
      <h2 style="font-size: 1.1rem; font-weight: bold; margin-bottom: 0.5rem;">Iroh P2P Gossip Swarm</h2>
      <p style="color: var(--muted); font-size: 0.9rem; margin-bottom: 1.5rem;">
        Browser nodes connect end-to-end encrypted through the free public Iroh relay, exchanging moves with zero centralized database.
      </p>

      <div style="padding: 1rem; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; margin-bottom: 1.5rem;">
        <div style="font-size: 0.85rem; color: var(--muted); margin-bottom: 0.25rem;">Node Status:</div>
        <div style="font-weight: 600; color: var(--primary);">{networkStatus}</div>
        {#if endpointId}
          <div style="font-size: 0.8rem; color: var(--muted); margin-top: 0.5rem; word-break: break-all;">
            My Endpoint ID: <span style="color: var(--text); font-family: monospace;">{endpointId}</span>
          </div>
        {/if}
      </div>

      {#if !irohNode}
        <button
          style="padding: 0.6rem 1.2rem; background: var(--primary); color: #0f172a; font-weight: 600; border: none; border-radius: 6px; cursor: pointer;"
          onclick={initIroh}
        >
          Initialize Iroh Node
        </button>
      {:else}
        <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
          <button
            style="padding: 0.6rem 1.2rem; background: var(--accent); color: #0f172a; font-weight: 600; border: none; border-radius: 6px; cursor: pointer;"
            onclick={createIrohRoom}
          >
            Create New Room
          </button>
          <div style="display: flex; flex: 1; gap: 0.5rem;">
            <input
              type="text"
              placeholder="Paste ticket to join..."
              bind:value={joinTicketInput}
              style="flex: 1; padding: 0.5rem; background: var(--bg); border: 1px solid var(--border); color: var(--text); border-radius: 6px; font-family: monospace; font-size: 0.85rem;"
            />
            <button
              style="padding: 0.6rem 1.2rem; background: var(--primary); color: #0f172a; font-weight: 600; border: none; border-radius: 6px; cursor: pointer;"
              onclick={joinIrohRoom}
            >
              Join Room
            </button>
          </div>
        </div>

        {#if currentTicket}
          <div style="padding: 1rem; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; margin-bottom: 1.5rem;">
            <div style="font-size: 0.85rem; color: var(--muted); margin-bottom: 0.25rem;">Shareable Room Ticket:</div>
            <textarea
              readonly
              rows="3"
              style="width: 100%; padding: 0.5rem; background: var(--card-bg); border: 1px solid var(--border); color: var(--accent); font-family: monospace; font-size: 0.75rem; border-radius: 4px;"
            >{currentTicket}</textarea>
          </div>
        {/if}

        {#if irohRoom}
          <div style="margin-top: 1.5rem;">
            <h3 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 0.5rem;">Broadcast Message to Room:</h3>
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
              <input
                type="text"
                bind:value={broadcastMsg}
                style="flex: 1; padding: 0.5rem; background: var(--bg); border: 1px solid var(--border); color: var(--text); border-radius: 6px; font-family: monospace; font-size: 0.85rem;"
              />
              <button
                style="padding: 0.5rem 1rem; background: var(--primary); color: #0f172a; font-weight: 600; border: none; border-radius: 6px; cursor: pointer;"
                onclick={broadcastMessage}
              >
                Send
              </button>
            </div>

            <h3 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 0.5rem;">Incoming Gossip Messages:</h3>
            <div style="max-height: 200px; overflow-y: auto; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 0.5rem;">
              {#if networkMessages.length === 0}
                <span style="color: var(--muted); font-size: 0.85rem;">No messages received yet.</span>
              {:else}
                {#each networkMessages as msg}
                  <div style="font-size: 0.85rem; padding: 0.25rem 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-family: monospace;">
                    <strong style="color: var(--primary);">{msg.from.slice(0, 10)}...:</strong> {msg.payload}
                  </div>
                {/each}
              {/if}
            </div>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</main>
