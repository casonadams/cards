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

<div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto p-4">
	<UiCard class="w-full max-w-lg">
		<CardHeader>
			<CardTitle class="text-center">You won the bid!</CardTitle>
			<p class="text-center text-sm text-muted-foreground">
				Select {NEST_SIZE} cards to discard and choose trump
			</p>
		</CardHeader>
		<CardContent class="space-y-4">
			<div>
				<p class="text-xs text-muted-foreground mb-1">
					Select {NEST_SIZE} cards to discard ({selectedDiscards.size}/{NEST_SIZE})
				</p>
				<div class="flex flex-wrap justify-center gap-1">
					{#each allCards as card (cardKey(card))}
						<PlayingCard
							{card}
							gameId="rook"
							size="sm"
							playable={true}
							selected={selectedDiscards.has(cardKey(card))}
							onclick={() => toggleDiscard(card)}
						/>
					{/each}
				</div>
			</div>

			<div>
				<p class="text-xs text-muted-foreground mb-1">Choose trump color</p>
				<div class="grid grid-cols-4 gap-2">
					{#each ROOK_COLORS as color (color)}
						<button
							class="rounded-lg border-2 px-2 py-1.5 text-sm font-medium transition-all {selectedTrump ===
							color
								? `${colorClasses[color]} border-primary`
								: `${colorClasses[color]} border-transparent opacity-60`}"
							onclick={() => (selectedTrump = color)}
						>
							{colorLabels[color]}
						</button>
					{/each}
				</div>
			</div>

			<Button class="w-full" onclick={handleConfirm} disabled={!canConfirm}>
				{canConfirm ? 'Confirm' : `Select ${NEST_SIZE - selectedDiscards.size} more to discard`}
			</Button>
		</CardContent>
	</UiCard>
</div>
