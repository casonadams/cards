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

<div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
	<Card class="w-full max-w-sm">
		<CardHeader>
			<CardTitle class="text-center">Bidding</CardTitle>
			<div class="flex justify-center gap-2 mt-2">
				<Badge variant="outline">Team 1: {rookState.team1Score}</Badge>
				<Badge variant="outline">Team 2: {rookState.team2Score}</Badge>
			</div>
		</CardHeader>
		<CardContent class="space-y-4">
			{#if rookState.highBid > 0}
				<p class="text-center text-sm">
					High bid: <span class="font-bold">{rookState.highBid}</span>
					by
					<span class="font-medium"
						>{playerNames[rookState.highBidderName] ?? rookState.highBidderName}</span
					>
				</p>
			{:else}
				<p class="text-center text-sm text-muted-foreground">No bids yet</p>
			{/if}

			{#if rookState.canBid}
				<div class="space-y-3">
					<div class="flex items-center justify-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onclick={() => (bidOffset = Math.max(0, bidOffset - 5))}
							disabled={bidOffset <= 0}>-</Button
						>
						<span class="text-2xl font-bold w-16 text-center">{bidAmount}</span>
						<Button
							variant="outline"
							size="sm"
							onclick={() => (bidOffset = Math.min(180 - rookState.minNextBid, bidOffset + 5))}
							disabled={bidAmount >= 180}>+</Button
						>
					</div>
					<div class="flex gap-2">
						<Button class="flex-1" onclick={() => onBid(bidAmount)}>Bid {bidAmount}</Button>
						<Button variant="secondary" class="flex-1" onclick={onPass}>Pass</Button>
					</div>
				</div>
			{:else}
				<p class="text-center text-sm text-muted-foreground">Waiting for other players...</p>
			{/if}
		</CardContent>
	</Card>
</div>
