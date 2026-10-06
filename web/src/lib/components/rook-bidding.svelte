<script lang="ts">
	import { Button } from '$lib/components/ui/button/index';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card/index';
	import { Badge } from '$lib/components/ui/badge/index';
	import type { RookUiState } from '$lib/games/rook/ui-state';

	interface Props {
		rookState: RookUiState;
		playerNames: Record<string, string>;
		onBid: (amount: number) => void;
		onPass: () => void;
	}

	let { rookState, playerNames, onBid, onPass }: Props = $props();

	let bidOffset = $state(0);
	const bidAmount = $derived(rookState.minNextBid + bidOffset);
</script>

<div class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
	<Card class="w-full max-w-sm border-border/80 bg-card/95 shadow-2xl overflow-hidden">
		<div class="h-1.5 w-full bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-500"></div>
		<CardHeader class="pb-2 text-center">
			<CardTitle class="text-xl font-black">Rook — Bidding</CardTitle>
			<div class="flex justify-center gap-2 mt-2">
				<Badge variant="outline" class="text-blue-400 border-blue-500/30 bg-blue-500/10 font-bold">Team 1: {rookState.team1Score}</Badge>
				<Badge variant="outline" class="text-amber-400 border-amber-500/30 bg-amber-500/10 font-bold">Team 2: {rookState.team2Score}</Badge>
			</div>
		</CardHeader>
		<CardContent class="space-y-4 pt-2">
			{#if rookState.highBid > 0}
				<div class="p-3 rounded-lg bg-background/50 border border-border/60 text-center">
					<span class="text-xs text-muted-foreground block mb-0.5">Current High Bid</span>
					<p class="text-base">
						<span class="font-black text-amber-400 text-lg">{rookState.highBid}</span>
						<span class="text-xs text-muted-foreground ml-1">by</span>
						<span class="font-bold text-foreground ml-1">
							{playerNames[rookState.highBidderName] ?? rookState.highBidderName}
						</span>
					</p>
				</div>
			{:else}
				<div class="p-3 rounded-lg bg-background/30 border border-border/40 text-center">
					<p class="text-xs text-muted-foreground">Opening round — no bids placed yet</p>
				</div>
			{/if}

			{#if rookState.canBid}
				<div class="space-y-3 pt-1">
					<div class="flex items-center justify-center gap-3 p-3 rounded-xl bg-background/60 border border-border/70">
						<Button
							variant="outline"
							size="sm"
							class="w-10 h-10 rounded-lg text-lg font-bold border-border/80"
							onclick={() => (bidOffset = Math.max(0, bidOffset - 5))}
							disabled={bidOffset <= 0}>−</Button
						>
						<div class="flex flex-col items-center">
							<span class="text-xs text-muted-foreground font-semibold">Your Bid</span>
							<span class="text-3xl font-black text-emerald-400 font-mono">{bidAmount}</span>
						</div>
						<Button
							variant="outline"
							size="sm"
							class="w-10 h-10 rounded-lg text-lg font-bold border-border/80"
							onclick={() => (bidOffset = Math.min(180 - rookState.minNextBid, bidOffset + 5))}
							disabled={bidAmount >= 180}>+</Button
						>
					</div>
					<div class="flex gap-2 pt-1">
						<Button class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 text-sm" onclick={() => onBid(bidAmount)}>
							Bid {bidAmount}
						</Button>
						<Button variant="secondary" class="flex-1 font-semibold text-sm border border-border/80" onclick={onPass}>
							Pass
						</Button>
					</div>
				</div>
			{:else}
				<div class="p-3 rounded-lg bg-background/40 border border-border/50 text-center">
					<p class="text-xs text-muted-foreground animate-pulse">Waiting for other players to bid...</p>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
