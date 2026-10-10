<script lang="ts">
	import { Button } from '$lib/components/ui/button/index';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card/index';
	import { Badge } from '$lib/components/ui/badge/index';
	import type { EuchreRoundState } from '$lib/games/euchre/types';
	import type { Suit } from '$lib/platform/types/card';
	import { RANK_NAMES } from '$lib/platform/types/card';

	interface Props {
		uiState: EuchreRoundState;
		playerNames: Record<string, string>;
		playerIds: readonly string[];
		myId: string;
		isDealer?: boolean;
		onAction: (action: {
			action: 'pass' | 'order_up' | 'pick_up' | 'call_suit';
			calledSuit?: Suit;
			goAlone?: boolean;
		}) => void;
	}

	let {
		uiState,
		playerNames,
		playerIds,
		myId,
		isDealer = false,
		onAction
	}: Props = $props();

	let goAlone = $state(false);

	const suitSymbols: Record<Suit, string> = {
		hearts: '♥',
		diamonds: '♦',
		clubs: '♣',
		spades: '♠'
	};

	const suitColors: Record<Suit, string> = {
		hearts: 'text-rose-400',
		diamonds: 'text-blue-400',
		clubs: 'text-emerald-400',
		spades: 'text-zinc-100'
	};

	const allSuits: readonly Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
	const availableRound2Suits = $derived(
		allSuits.filter((s) => s !== uiState.upcard.suit)
	);
</script>

<div class="w-full max-w-md mx-auto animate-in fade-in duration-200">
	<Card class="border-border/80 bg-card/90 shadow-xl backdrop-blur-md overflow-hidden rounded-xl sm:tall:rounded-2xl border">
		<div class="h-1 sm:tall:h-1.5 w-full bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-500 shrink-0"></div>
		<CardHeader class="p-2 sm:tall:px-4 sm:tall:pt-3 sm:tall:pb-2">
			<div class="flex items-center justify-between">
				<Badge variant="outline" class="text-[10px] sm:tall:text-xs font-bold py-0.5 px-2 border-amber-500/30 bg-amber-500/10 text-amber-300">
					Euchre — {uiState.phase === 'naming_round1' ? 'Round 1: Upcard' : 'Round 2: Call Trump'}
				</Badge>
				<label class="flex items-center gap-1.5 cursor-pointer text-[10px] sm:tall:text-xs font-bold text-amber-200">
					<input
						type="checkbox"
						bind:checked={goAlone}
						class="rounded accent-amber-500 cursor-pointer w-3.5 h-3.5"
					/>
					<span>Go Alone (+4 pts)</span>
				</label>
			</div>

			<!-- Turned up card preview -->
			<div class="flex items-center justify-between mt-1.5 p-1.5 rounded-lg bg-background/60 border border-border/80 text-xs">
				<div class="flex items-center gap-2">
					<span class="text-muted-foreground font-medium text-[11px]">Upcard:</span>
					<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white text-zinc-950 font-black text-xs shadow-xs border">
						<span>{RANK_NAMES[uiState.upcard.rank]}</span>
						<span class="{suitColors[uiState.upcard.suit]}">{suitSymbols[uiState.upcard.suit]}</span>
					</span>
				</div>
				<span class="text-[10px] text-muted-foreground">
					{isDealer ? "You are Dealer" : "Dealer at table"}
				</span>
			</div>
		</CardHeader>
		<CardContent class="p-2 sm:tall:p-4 pt-0 sm:tall:pt-0 flex flex-col gap-2">
			{#if uiState.phase === 'naming_round1'}
				<div class="flex gap-2">
					<Button
						variant="outline"
						class="flex-1 text-xs h-8 sm:tall:h-9 font-bold cursor-pointer hover:bg-muted"
						onclick={() => onAction({ action: 'pass' })}
					>
						Pass
					</Button>
					<Button
						class="flex-1 bg-amber-600 hover:bg-amber-500 text-white text-xs h-8 sm:tall:h-9 font-black cursor-pointer shadow-md"
						onclick={() => onAction({ action: isDealer ? 'pick_up' : 'order_up', goAlone })}
					>
						{isDealer ? 'Pick It Up' : 'Order It Up'}
					</Button>
				</div>
			{:else}
				<div class="flex flex-col gap-1.5">
					<span class="text-[10px] sm:tall:text-xs text-muted-foreground text-center">
						Select a suit to make trump:
					</span>
					<div class="grid grid-cols-3 gap-1.5">
						{#each availableRound2Suits as s (s)}
							<button
								type="button"
								class="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border border-border/80 bg-background/70 hover:border-amber-400 hover:bg-card text-xs font-bold transition-all cursor-pointer capitalize"
								onclick={() => onAction({ action: 'call_suit', calledSuit: s, goAlone })}
							>
								<span class="{suitColors[s]} font-black text-sm">{suitSymbols[s]}</span>
								<span>{s}</span>
							</button>
						{/each}
					</div>
					<Button
						variant="ghost"
						class="text-xs h-7 text-muted-foreground hover:text-foreground mt-0.5 cursor-pointer"
						onclick={() => onAction({ action: 'pass' })}
					>
						Pass
					</Button>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
