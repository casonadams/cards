<script lang="ts">
	import { Button } from '$lib/components/ui/button/index';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card/index';
	import { Badge } from '$lib/components/ui/badge/index';
	import type { OhWellUiState } from '$lib/games/oh-well/ui-state';

	interface Props {
		uiState: OhWellUiState;
		playerNames: Record<string, string>;
		onBid: (bid: number) => void;
	}

	let { uiState, playerNames, onBid }: Props = $props();

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

<div class="w-full max-w-lg mx-auto animate-in fade-in duration-200">
	<Card class="border-border/80 bg-card/90 shadow-xl backdrop-blur-md overflow-hidden rounded-2xl border">
		<div class="h-1.5 w-full bg-gradient-to-r from-amber-500 via-emerald-500 to-teal-500 rounded-t-2xl shrink-0"></div>
		<CardHeader class="pb-2 pt-3 px-4 sm:px-6">
			<div class="flex items-center justify-between">
				<Badge variant="outline" class="text-xs font-bold border-amber-500/30 bg-amber-500/10 text-amber-300">
					{uiState.cardsPerPlayer}-Card Round — Bidding
				</Badge>
				{#if uiState.trumpSuit}
					<span class="text-xs font-bold text-amber-300 capitalize">
						Trump: {uiState.trumpSuit}
					</span>
				{:else}
					<span class="text-xs text-muted-foreground">No Trump</span>
				{/if}
			</div>
			{#if uiState.leaderId}
				<div class="flex items-center justify-between mt-2 px-3 py-1.5 rounded-xl bg-background/60 border border-border/80 text-xs">
					<div class="flex items-center gap-1.5">
						<span class="text-emerald-400 font-black">1st Bid & Lead:</span>
						<span class="font-extrabold text-foreground">{playerNames[uiState.leaderId] ?? uiState.leaderId}</span>
					</div>
					{#if uiState.dealerId}
						<div class="flex items-center gap-1 text-[11px] text-muted-foreground">
							<span>Dealer:</span>
							<span class="font-bold text-foreground">{playerNames[uiState.dealerId] ?? uiState.dealerId}</span>
						</div>
					{/if}
				</div>
			{/if}
		</CardHeader>
		<CardContent class="gap-3 pt-1 px-4 sm:px-6 pb-4">
			{#if uiState.bids.length > 0}
				<div class="flex flex-wrap items-center justify-center gap-1.5 p-2 rounded-xl bg-background/50 border border-border/60">
					<span class="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mr-1">Bids:</span>
					{#each uiState.bids as bid (bid.playerId)}
						<span class="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-card border border-border/80">
							{#if bid.playerId === uiState.leaderId}
								<span class="text-[9px] font-black text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1 py-0.2 rounded" title="Bids 1st & leads">1st</span>
							{:else if bid.playerId === uiState.dealerId}
								<span class="text-[9px] font-black text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1 py-0.2 rounded" title="Dealer (bids last)">D</span>
							{/if}
							<span class="font-semibold text-muted-foreground">{playerNames[bid.playerId] ?? bid.playerId}:</span>
							<span class="font-mono font-black text-foreground">{bid.bid}</span>
						</span>
					{/each}
				</div>
			{/if}

			{#if uiState.canBid}
				<div class="flex flex-col gap-2.5 pt-0.5">
					<p class="text-xs text-muted-foreground font-semibold text-center">Select your bid:</p>
					<div class="flex flex-wrap justify-center gap-1.5 max-w-sm mx-auto">
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
							Dealer Hook: Total bids cannot equal {uiState.cardsPerPlayer}. You cannot bid {uiState.hookBid}.
						</p>
					{/if}
					<Button
						class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 shadow-md shadow-emerald-950/40 text-sm rounded-xl cursor-pointer"
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
