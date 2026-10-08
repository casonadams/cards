<script lang="ts">
	import { Button } from '$lib/components/ui/button/index';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card/index';
	import { Badge } from '$lib/components/ui/badge/index';
	import PlayingCard from './playing-card.svelte';
	import { sortHand } from '$lib/platform/engine/sort-hand';
	import type { OhWellUiState } from '$lib/games/oh-well/ui-state';
	import type { Card as CardType, Suit } from '$lib/platform/types/index';

	interface Props {
		uiState: OhWellUiState;
		myHand: readonly CardType[];
		playerNames: Record<string, string>;
		onBid: (bid: number) => void;
	}

	let { uiState, myHand, playerNames, onBid }: Props = $props();

	let selectedBid = $state(0);

	function isBlockedZero(hook: number | null, bid: number): boolean {
		return hook === 0 && bid === 0;
	}

	$effect(() => {
		if (isBlockedZero(uiState.hookBid, selectedBid) && uiState.cardsPerPlayer > 0) {
			selectedBid = 1;
		}
	});

	const bidOptions = $derived(Array.from({ length: uiState.cardsPerPlayer + 1 }, (_, i) => i));
</script>

<div class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-start sm:items-center justify-center z-50 overflow-y-auto p-3 sm:p-4 animate-in fade-in duration-200">
	<Card class="w-full max-w-md border-border/80 bg-card/95 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
		<div class="h-1.5 w-full bg-gradient-to-r from-amber-500 via-emerald-500 to-teal-500 rounded-t-lg shrink-0"></div>
		<CardHeader class="pb-2 text-center shrink-0">
			<CardTitle class="text-xl font-black">
				{uiState.cardsPerPlayer}-Card Round — Bidding
			</CardTitle>
			{#if uiState.trumpSuit}
				<p class="text-xs text-muted-foreground">
					Trump: <span class="font-bold text-amber-300 capitalize">{uiState.trumpSuit}</span>
				</p>
			{:else}
				<p class="text-xs text-muted-foreground">No Trump Round</p>
			{/if}
		</CardHeader>
		<CardContent class="gap-3 pt-1 overflow-y-auto px-4 sm:px-6 pb-5">
			{#if uiState.bids.length > 0}
				<div class="flex flex-col gap-1.5 p-2.5 rounded-lg bg-background/50 border border-border/60 shrink-0">
					<p class="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Current Bids</p>
					{#each uiState.bids as bid (bid.playerId)}
						<div class="flex justify-between items-center text-xs">
							<span class="font-medium">{playerNames[bid.playerId] ?? bid.playerId}</span>
							<Badge variant="outline" class="font-mono font-bold bg-background/60">{bid.bid} {bid.bid === 1 ? 'trick' : 'tricks'}</Badge>
						</div>
					{/each}
				</div>
			{/if}

			<div class="p-2 rounded-xl bg-background/30 border border-border/40 shrink-0">
				<p class="text-[11px] text-muted-foreground font-medium text-center mb-1">Your Hand</p>
				<div class="flex items-center justify-center -space-x-5 overflow-x-auto py-1 px-3 card-fan-scroll">
					{#each sortHand(myHand, uiState.trumpSuit as Suit | null) as card, idx (`${card.suit}-${card.rank}`)}
						<div class="shrink-0 transform transition-transform hover:-translate-y-2 hover:z-20 relative" style:z-index={idx}>
							<PlayingCard
								{card}
								gameId="oh-well"
								trumpSuit={uiState.trumpSuit}
								playable={true}
								size="sm"
							/>
						</div>
					{/each}
				</div>
			</div>
			{#if uiState.canBid}
				<div class="flex flex-col gap-2.5 pt-0.5 shrink-0">
					<p class="text-xs text-muted-foreground font-semibold text-center">How many tricks will you take?</p>
					<div class="flex flex-wrap justify-center gap-1.5 max-w-xs mx-auto">
						{#each bidOptions as n (n)}
							{@const isHook = uiState.hookBid === n}
							<button
								class="w-9 h-9 sm:w-10 sm:h-10 rounded-lg border text-xs sm:text-sm font-bold transition-all flex items-center justify-center cursor-pointer
									{selectedBid === n
									? 'border-2 border-emerald-400 bg-emerald-500 text-zinc-950 font-black shadow-md'
									: 'border-border/80 bg-background/50 text-foreground hover:border-border hover:bg-card'}
									{isHook ? 'opacity-35 cursor-not-allowed line-through hover:border-border/80' : ''}"
								onclick={() => {
									if (!isHook) selectedBid = n;
								}}
								disabled={isHook}
								title={isHook ? `Hook rule: cannot bid ${n}` : `Bid ${n}`}
							>
								{n}
							</button>
						{/each}
					</div>
					{#if uiState.hookBid !== null}
						<p class="text-[11px] text-amber-400/90 text-center font-medium bg-amber-500/10 py-1 px-2 rounded-md border border-amber-500/20">
							⚠️ Dealer Hook: Total bids cannot equal {uiState.cardsPerPlayer}. You cannot bid {uiState.hookBid}.
						</p>
					{/if}
					<Button
						class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 shadow-md shadow-emerald-950/40 text-sm"
						onclick={() => onBid(selectedBid)}
						disabled={selectedBid === uiState.hookBid}
					>
						Confirm Bid: {selectedBid} {selectedBid === 1 ? 'Trick' : 'Tricks'}
					</Button>
				</div>
			{:else}
				<div class="p-3 rounded-lg bg-background/40 border border-border/50 text-center">
					<p class="text-xs text-muted-foreground animate-pulse">Waiting for other players to place their bids...</p>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
