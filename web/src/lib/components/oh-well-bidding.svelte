<script lang="ts">
	import { Button } from '$lib/components/ui/button/index';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card/index';
	import { Badge } from '$lib/components/ui/badge/index';
	import PlayingCard from './playing-card.svelte';
	import { sortHand } from '$lib/engine/sort-hand';
	import type { Card as CardType, Suit } from '$lib/types/card';

	interface Props {
		cardsPerPlayer: number;
		trumpSuit: Suit | null;
		myHand: readonly CardType[];
		playerNames: Record<string, string>;
		existingBids: readonly { player_id: string; bid: number }[];
		hookBid: number | null;
		isMyTurn: boolean;
		currentBidderName: string;
		onBid: (bid: number) => void;
	}

	let {
		cardsPerPlayer,
		trumpSuit,
		myHand,
		playerNames,
		existingBids,
		hookBid,
		isMyTurn,
		currentBidderName,
		onBid
	}: Props = $props();

	let selectedBid = $state(0);

	$effect(() => {
		if (hookBid !== null && hookBid === 0 && selectedBid === 0 && cardsPerPlayer > 0) {
			selectedBid = 1;
		}
	});

	const bidOptions = $derived(Array.from({ length: cardsPerPlayer + 1 }, (_, i) => i));
	const sortedHand = $derived(sortHand(myHand, trumpSuit));
</script>

<div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto p-4">
	<Card class="w-full max-w-md">
		<CardHeader>
			<CardTitle class="text-center">
				{cardsPerPlayer}-Card Round Bidding
			</CardTitle>
			{#if trumpSuit}
				<p class="text-center text-sm text-muted-foreground">
					Trump: <span class="font-bold capitalize">{trumpSuit}</span>
				</p>
			{:else}
				<p class="text-center text-sm text-muted-foreground">No Trump</p>
			{/if}
		</CardHeader>
		<CardContent class="space-y-4">
			<div>
				<p class="text-xs font-semibold text-muted-foreground mb-2 text-center">Your Hand</p>
				<div class="flex flex-wrap justify-center gap-1">
					{#each sortedHand as card (`${card.suit}-${card.rank}`)}
						<PlayingCard {card} {trumpSuit} size="sm" />
					{/each}
				</div>
			</div>

			<div>
				<p class="text-xs font-semibold text-muted-foreground mb-2">Bids Placed</p>
				<div class="space-y-1 text-sm">
					{#if existingBids.length === 0}
						<p class="text-muted-foreground text-xs italic">No bids yet</p>
					{:else}
						{#each existingBids as bid (bid.player_id)}
							<div class="flex justify-between items-center py-0.5 border-b border-border/30">
								<span>{playerNames[bid.player_id] ?? bid.player_id}</span>
								<Badge variant="outline" class="font-mono">{bid.bid}</Badge>
							</div>
						{/each}
					{/if}
				</div>
			</div>

			{#if isMyTurn}
				<div class="space-y-3">
					<p class="text-sm font-medium text-center">Select Your Bid (Tricks to Win)</p>
					<div class="flex flex-wrap justify-center gap-1.5">
						{#each bidOptions as bid (bid)}
							{@const isHook = hookBid !== null && bid === hookBid}
							<Button
								variant={selectedBid === bid ? 'default' : 'outline'}
								size="sm"
								disabled={isHook}
								class="w-9 h-9 p-0 {isHook ? 'line-through opacity-30' : ''}"
								onclick={() => (selectedBid = bid)}
							>
								{bid}
							</Button>
						{/each}
					</div>

					{#if hookBid !== null}
						<p class="text-center text-xs text-destructive">
							Dealer Hook Rule: Total bids cannot equal {cardsPerPlayer}. You cannot bid {hookBid}.
						</p>
					{/if}

					<Button class="w-full" onclick={() => onBid(selectedBid)}>
						Confirm Bid of {selectedBid}
					</Button>
				</div>
			{:else}
				<p class="text-center text-sm text-muted-foreground animate-pulse">
					Waiting for {currentBidderName} to bid...
				</p>
			{/if}
		</CardContent>
	</Card>
</div>
