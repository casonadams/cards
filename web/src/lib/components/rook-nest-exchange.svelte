<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { Button } from '$lib/components/ui/button/index';
	import {
		Card as UiCard,
		CardHeader,
		CardTitle,
		CardContent
	} from '$lib/components/ui/card/index';
	import PlayingCard from './playing-card.svelte';
	import { sortRookHand } from '$lib/games/rook/sort-hand';
	import { ROOK_COLORS, NEST_SIZE } from '$lib/games/rook/types';
	import type { Card } from '$lib/platform/types/index';
	import type { RookColor } from '$lib/games/rook/types';

	interface Props {
		myHand: readonly Card[];
		nestCards: readonly Card[];
		onConfirm: (discards: readonly Card[], trump: RookColor) => void;
	}

	let { myHand, nestCards, onConfirm }: Props = $props();

	let selectedTrump = $state<RookColor>('black');
	let selectedDiscards = new SvelteSet<string>();

	const allCards = $derived(sortRookHand([...myHand, ...nestCards]));
	const canConfirm = $derived(selectedDiscards.size === NEST_SIZE);

	function cardKey(card: Card): string {
		return `${card.suit}-${card.rank}`;
	}

	function toggleDiscard(card: Card) {
		const key = cardKey(card);
		if (selectedDiscards.has(key)) selectedDiscards.delete(key);
		else if (selectedDiscards.size < NEST_SIZE) selectedDiscards.add(key);
	}

	function handleConfirm() {
		const discards = allCards.filter((c) => selectedDiscards.has(cardKey(c)));
		onConfirm(discards, selectedTrump);
	}

	const colorLabels: Record<RookColor, string> = {
		black: 'Black',
		red: 'Red',
		green: 'Green',
		yellow: 'Yellow'
	};

	const colorClasses: Record<RookColor, string> = {
		black: 'bg-gray-800 text-gray-200',
		red: 'bg-red-900 text-red-200',
		green: 'bg-green-900 text-green-200',
		yellow: 'bg-yellow-900 text-yellow-200'
	};
</script>

<div class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 overflow-y-auto p-4 animate-in fade-in duration-200">
	<UiCard class="w-full max-w-lg border-border/80 bg-card/95 shadow-2xl overflow-hidden my-auto">
		<div class="h-1.5 w-full bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-500"></div>
		<CardHeader class="pb-2 text-center">
			<div class="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold mx-auto mb-1 border border-emerald-500/20">
				<span>High Bidder Action</span>
			</div>
			<CardTitle class="text-xl font-black">Exchange the Nest</CardTitle>
			<p class="text-xs text-muted-foreground">
				Select exactly {NEST_SIZE} cards to discard and declare trump
			</p>
		</CardHeader>
		<CardContent class="gap-4 pt-1">
			<div class="p-3 rounded-xl bg-background/50 border border-border/60">
				<div class="flex items-center justify-between text-xs text-muted-foreground font-medium mb-2 px-1">
					<span>Your Cards & Nest</span>
					<span class="font-bold text-foreground bg-muted px-2 py-0.5 rounded-full">
						Discards: {selectedDiscards.size} / {NEST_SIZE}
					</span>
				</div>
				<div class="flex flex-wrap justify-center gap-1.5 py-1">
					{#each allCards as card (cardKey(card))}
						<div class="transform transition-transform hover:-translate-y-1">
							<PlayingCard
								{card}
								gameId="rook"
								size="sm"
								playable={true}
								selected={selectedDiscards.has(cardKey(card))}
								onclick={() => toggleDiscard(card)}
							/>
						</div>
					{/each}
				</div>
			</div>

			<div class="flex flex-col gap-2">
				<p class="text-xs font-semibold text-muted-foreground px-1">Choose Trump Color</p>
				<div class="grid grid-cols-4 gap-2">
					{#each ROOK_COLORS as color (color)}
						<button
							class="rounded-xl border-2 p-2 text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 {selectedTrump === color
								? 'border-emerald-500 bg-emerald-500/15 text-emerald-300 shadow-sm ring-2 ring-emerald-500/20'
								: 'border-border/80 bg-background/50 text-muted-foreground hover:border-border hover:bg-card'}"
							onclick={() => (selectedTrump = color)}
						>
							<span class="capitalize">{colorLabels[color]}</span>
							{#if selectedTrump === color}
								<span class="text-[10px] text-emerald-400">✓</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>

			<Button
				class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 shadow-md shadow-emerald-950/40 text-sm"
				onclick={handleConfirm}
				disabled={!canConfirm}
			>
				{canConfirm ? `Confirm Discards & Trump (${colorLabels[selectedTrump]})` : `Select ${NEST_SIZE - selectedDiscards.size} More Cards`}
			</Button>
		</CardContent>
	</UiCard>
</div>
