<script lang="ts">
	import { Button } from '$lib/components/ui/button/index';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card/index';
	import { Badge } from '$lib/components/ui/badge/index';
	import type { WizardRoundState } from '$lib/games/wizard/types';
	import type { Suit } from '$lib/platform/types/card';
	import { RANK_NAMES } from '$lib/platform/types/card';

	interface Props {
		uiState: WizardRoundState;
		currentRound: number;
		cardsPerPlayer: number;
		playerNames: Record<string, string>;
		playerIds: readonly string[];
		myId: string;
		onBid: (bid: number) => void;
	}

	let {
		uiState,
		currentRound,
		cardsPerPlayer,
		playerNames,
		playerIds,
		myId,
		onBid
	}: Props = $props();

	let selectedBid = $state(0);

	const suitSymbols: Record<string, string> = {
		hearts: '♥',
		diamonds: '♦',
		clubs: '♣',
		spades: '♠'
	};

	const suitColors: Record<string, string> = {
		hearts: 'text-rose-400',
		diamonds: 'text-blue-400',
		clubs: 'text-emerald-400',
		spades: 'text-zinc-100'
	};

	const bidOptions = $derived(Array.from({ length: cardsPerPlayer + 1 }, (_, i) => i));
</script>

<div class="w-full max-w-md mx-auto animate-in fade-in duration-200">
	<Card class="border-border/80 bg-card/90 shadow-xl backdrop-blur-md overflow-hidden rounded-xl sm:tall:rounded-2xl border">
		<div class="h-1 sm:tall:h-1.5 w-full bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500 shrink-0"></div>
		<CardHeader class="p-2 sm:tall:px-4 sm:tall:pt-3 sm:tall:pb-2">
			<div class="flex items-center justify-between">
				<Badge variant="outline" class="text-[10px] sm:tall:text-xs font-bold py-0.5 px-2 border-purple-500/30 bg-purple-500/10 text-purple-300">
					Wizard — Round {currentRound + 1} ({cardsPerPlayer} {cardsPerPlayer === 1 ? 'Card' : 'Cards'})
				</Badge>
				{#if uiState.trumpCard}
					{@const tc = uiState.trumpCard}
					<span class="inline-flex items-center gap-1 text-[10px] sm:tall:text-xs font-bold text-purple-200">
						<span>Trump:</span>
						<span class="px-1.5 py-0.2 bg-white text-zinc-950 rounded font-black text-[10px]">
							{RANK_NAMES[tc.rank]}
							<span class="{suitColors[tc.suit]}">{suitSymbols[tc.suit]}</span>
						</span>
					</span>
				{:else if uiState.trumpSuit}
					<span class="text-[10px] sm:tall:text-xs font-bold capitalize {suitColors[uiState.trumpSuit]}">
						Trump: {uiState.trumpSuit} {suitSymbols[uiState.trumpSuit]}
					</span>
				{:else}
					<span class="text-[10px] sm:tall:text-xs text-muted-foreground">No Trump</span>
				{/if}
			</div>

			<!-- Bids placed so far -->
			{#if uiState.bids.length > 0}
				<div class="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-border/50">
					{#each uiState.bids as b (b.playerId)}
						<span class="text-[9px] sm:tall:text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground font-medium">
							<strong class="text-foreground">{playerNames[b.playerId] ?? b.playerId}:</strong>
							<span class="text-purple-300 font-bold ml-0.5">{b.bid}t</span>
						</span>
					{/each}
				</div>
			{/if}
		</CardHeader>
		<CardContent class="p-2 sm:tall:p-4 pt-0 sm:tall:pt-0 flex flex-col gap-2">
			<span class="text-[10px] sm:tall:text-xs text-muted-foreground text-center">
				Predict exact tricks taken (+20 bonus + 10/trick):
			</span>

			<div class="flex flex-wrap gap-1 justify-center max-h-[72px] sm:tall:max-h-none overflow-y-auto py-0.5">
				{#each bidOptions as n (n)}
					<button
						type="button"
						class="w-7 h-7 sm:tall:w-8 sm:tall:h-8 rounded-md text-xs font-black transition-all cursor-pointer border flex items-center justify-center {selectedBid === n
							? 'bg-purple-600 border-purple-400 text-white shadow-sm ring-1 ring-purple-400'
							: 'bg-background/80 border-border/80 text-foreground hover:border-purple-400/50'}"
						onclick={() => (selectedBid = n)}
					>
						{n}
					</button>
				{/each}
			</div>

			<Button
				class="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-1.5 sm:tall:py-2 text-xs sm:tall:text-sm h-8 sm:tall:h-9 shadow-md rounded-lg cursor-pointer"
				onclick={() => onBid(selectedBid)}
			>
				Confirm Bid: {selectedBid} {selectedBid === 1 ? 'Trick' : 'Tricks'}
			</Button>
		</CardContent>
	</Card>
</div>
