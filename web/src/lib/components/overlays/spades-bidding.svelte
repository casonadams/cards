<script lang="ts">
	import { Button } from '$lib/components/ui/button/index';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card/index';
	import { Badge } from '$lib/components/ui/badge/index';
	import type { SpadesRoundState, SpadesBidType } from '$lib/games/spades/types';

	interface Props {
		uiState: SpadesRoundState;
		playerNames: Record<string, string>;
		playerIds: readonly string[];
		myId: string;
		maxBid?: number;
		isHandRevealed?: boolean;
		onRevealHand?: () => void;
		onBid: (bid: { bidType: SpadesBidType; amount: number }) => void;
	}

	let {
		uiState,
		playerNames,
		playerIds,
		myId,
		maxBid = 13,
		isHandRevealed = false,
		onRevealHand,
		onBid
	}: Props = $props();

	let selectedType = $state<SpadesBidType>('regular');
	let selectedAmount = $state(2);

	$effect(() => {
		if (isHandRevealed && selectedType === 'blind_nil') {
			selectedType = 'regular';
		}
	});

	const bidOptions = $derived(Array.from({ length: maxBid }, (_, i) => i + 1));
	const myIndex = $derived(playerIds.indexOf(myId));
	const isMyTurnToBid = $derived(uiState.currentBidder === myIndex);
	const currentBidderId = $derived(
		uiState.currentBidder >= 0 && uiState.currentBidder < playerIds.length
			? playerIds[uiState.currentBidder]
			: null
	);
	const currentBidderName = $derived(
		currentBidderId ? (playerNames[currentBidderId] ?? currentBidderId) : 'player'
	);

	function handleConfirm() {
		if (!isMyTurnToBid) return;
		if (selectedType === 'nil' || selectedType === 'blind_nil') {
			onBid({ bidType: selectedType, amount: 0 });
		} else {
			onBid({ bidType: 'regular', amount: selectedAmount });
		}
	}
</script>

<div class="w-full max-w-md mx-auto animate-in fade-in duration-200">
	<Card class="border-border/80 bg-card/90 shadow-xl backdrop-blur-md overflow-hidden rounded-xl sm:tall:rounded-2xl border">
		<div class="h-1 sm:tall:h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500 shrink-0"></div>
		<CardHeader class="p-2 sm:tall:px-4 sm:tall:pt-3 sm:tall:pb-2">
			<div class="flex items-center justify-between">
				<Badge variant="outline" class="text-[10px] sm:tall:text-xs font-bold py-0.5 px-2 border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
					Spades — Contract Bidding
				</Badge>
				<span class="text-[10px] sm:tall:text-xs font-bold text-muted-foreground uppercase">
					{uiState.mode === '4p_solo' ? '4P Solo' : uiState.mode === '6p_teams' ? '6P Double Deck' : '4P Teams (2v2)'}
				</span>
			</div>

			<!-- Bids placed so far -->
			{#if uiState.bids.length > 0}
				<div class="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-border/50">
					{#each uiState.bids as b (b.playerId)}
						<span class="text-[9px] sm:tall:text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground font-medium">
							<strong class="text-foreground">{playerNames[b.playerId] ?? b.playerId}:</strong>
							<span class="text-emerald-400 font-bold ml-0.5">
								{b.bidType === 'nil' ? 'Nil' : b.bidType === 'blind_nil' ? 'Blind Nil' : `${b.amount}t`}
							</span>
						</span>
					{/each}
				</div>
			{/if}
		</CardHeader>
		<CardContent class="p-2 sm:tall:p-4 pt-0 sm:tall:pt-0 flex flex-col gap-2">
			{#if !isHandRevealed}
				<button
					type="button"
					class="w-full py-1.5 px-3 rounded-lg text-[11px] sm:tall:text-xs font-bold border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
					onclick={() => onRevealHand?.()}
				>
					<span>👀</span> Look at Cards / Reveal Hand
				</button>
			{:else}
				<div class="flex items-center justify-center gap-1.5 py-0.5 text-[10px] text-muted-foreground/80 font-medium">
					<span>🃏 Hand revealed (Blind Nil disqualified)</span>
				</div>
			{/if}

			{#if isMyTurnToBid}
				<!-- Bid Type Switcher: Regular vs Nil vs Blind Nil -->
				<div class="flex gap-1.5">
					<button
						type="button"
						class="flex-1 py-1 px-1.5 rounded-lg text-[10px] sm:tall:text-xs font-bold transition-all cursor-pointer border {selectedType === 'regular'
							? 'bg-emerald-600 border-emerald-500 text-white shadow-xs'
							: 'bg-muted/40 border-border/70 text-muted-foreground hover:text-foreground'}"
						onclick={() => {
							selectedType = 'regular';
							if (!isHandRevealed) onRevealHand?.();
						}}
					>
						Regular Bid
					</button>
					<button
						type="button"
						class="flex-1 py-1 px-1.5 rounded-lg text-[10px] sm:tall:text-xs font-bold transition-all cursor-pointer border {selectedType === 'nil'
							? 'bg-amber-600 border-amber-500 text-white shadow-xs'
							: 'bg-muted/40 border-border/70 text-muted-foreground hover:text-foreground'}"
						onclick={() => {
							selectedType = 'nil';
							if (!isHandRevealed) onRevealHand?.();
						}}
					>
						Nil (+100 / -100)
					</button>
					<button
						type="button"
						disabled={isHandRevealed}
						class="flex-1 py-1 px-1.5 rounded-lg text-[10px] sm:tall:text-xs font-bold transition-all border {isHandRevealed
							? 'opacity-40 cursor-not-allowed bg-muted/20 border-border/40 text-muted-foreground line-through'
							: selectedType === 'blind_nil'
								? 'bg-indigo-600 border-indigo-500 text-white shadow-xs cursor-pointer'
								: 'bg-muted/40 border-border/70 text-muted-foreground hover:text-foreground cursor-pointer'}"
						onclick={() => {
							if (!isHandRevealed) selectedType = 'blind_nil';
						}}
						title={isHandRevealed ? 'Blind Nil is disqualified once cards are viewed' : 'Contract to take 0 tricks declared without looking at hand'}
					>
						Blind Nil (+200)
					</button>
				</div>

				<!-- Number of Tricks (if regular bid) -->
				{#if selectedType === 'regular'}
					<div class="flex flex-wrap gap-1 justify-center max-h-[72px] sm:tall:max-h-none overflow-y-auto py-0.5">
						{#each bidOptions as n (n)}
							<button
								type="button"
								class="w-7 h-7 sm:tall:w-8 sm:tall:h-8 rounded-md text-xs font-black transition-all cursor-pointer border flex items-center justify-center {selectedAmount === n
									? 'bg-emerald-500 border-emerald-400 text-zinc-950 shadow-sm'
									: 'bg-background/80 border-border/80 text-foreground hover:border-emerald-500/50'}"
								onclick={() => (selectedAmount = n)}
							>
								{n}
							</button>
						{/each}
					</div>
				{:else}
					<p class="text-[10px] sm:tall:text-xs text-muted-foreground text-center py-1">
						{selectedType === 'nil'
							? 'Contract to take 0 tricks. Success earns +100 pts, failure loses -100 pts.'
							: 'Contract to take 0 tricks declared blind. Success earns +200 pts, failure loses -200 pts.'}
					</p>
				{/if}

				<Button
					class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-1.5 sm:tall:py-2 text-xs sm:tall:text-sm h-8 sm:tall:h-9 shadow-md rounded-lg cursor-pointer"
					onclick={handleConfirm}
				>
					Confirm {selectedType === 'nil' ? 'Nil' : selectedType === 'blind_nil' ? 'Blind Nil' : `${selectedAmount} Tricks`}
				</Button>
			{:else}
				<div class="py-4 text-center flex flex-col items-center justify-center gap-1.5">
					<div class="flex items-center gap-2 text-xs sm:tall:text-sm font-semibold text-foreground">
						<span class="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
						Waiting for <span class="text-emerald-400 font-bold">{currentBidderName}</span> to place bid...
					</div>
					<span class="text-[10px] text-muted-foreground">
						Bids are placed clockwise in order
					</span>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
