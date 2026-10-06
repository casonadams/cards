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

<div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto p-4">
	<Card class="w-full max-w-md">
		<CardHeader>
			<CardTitle class="text-center">
				{uiState.cardsPerPlayer}-Card Round
			</CardTitle>
			{#if uiState.trumpSuit}
				<p class="text-center text-sm text-muted-foreground">
					Trump: <span class="font-bold capitalize">{uiState.trumpSuit}</span>
				</p>
			{:else}
				<p class="text-center text-sm text-muted-foreground">No Trump</p>
			{/if}
		</CardHeader>
		<CardContent class="space-y-4">
			{#if uiState.bids.length > 0}
				<div class="space-y-1">
					{#each uiState.bids as bid (bid.playerId)}
						<div class="flex justify-between text-sm">
							<span>{playerNames[bid.playerId] ?? bid.playerId}</span>
							<Badge variant="outline">{bid.bid}</Badge>
						</div>
					{/each}
				</div>
			{/if}

			<div class="flex flex-wrap justify-center gap-1">
				{#each sortHand(myHand, uiState.trumpSuit as Suit | null) as card (`${card.suit}-${card.rank}`)}
					<PlayingCard {card} size="sm" />
				{/each}
			</div>

			{#if uiState.canBid}
				<div class="space-y-2">
					<p class="text-sm text-muted-foreground text-center">How many tricks will you take?</p>
					<div class="flex flex-wrap justify-center gap-1">
						{#each bidOptions as n (n)}
							{@const isHook = uiState.hookBid === n}
							<button
								class="rounded-md border px-3 py-1.5 text-sm font-medium transition-all
									{selectedBid === n
									? 'border-primary bg-primary/10 text-primary'
									: 'border-border text-muted-foreground hover:border-muted-foreground'}
									{isHook ? 'opacity-30 cursor-not-allowed' : ''}"
								onclick={() => {
									if (!isHook) selectedBid = n;
								}}
								disabled={isHook}
							>
								{n}
							</button>
						{/each}
					</div>
					{#if uiState.hookBid !== null}
						<p class="text-xs text-muted-foreground text-center">
							You cannot bid {uiState.hookBid} (hook rule)
						</p>
					{/if}
					<Button
						class="w-full"
						onclick={() => onBid(selectedBid)}
						disabled={selectedBid === uiState.hookBid}
					>
						Bid {selectedBid}
					</Button>
				</div>
			{:else}
				<p class="text-center text-sm text-muted-foreground">Waiting for other players to bid...</p>
			{/if}
		</CardContent>
	</Card>
</div>
