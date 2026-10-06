<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index';
	import PlayingCard from './playing-card.svelte';
	import RegicideRules from './regicide-rules.svelte';
	import RegicideEnemy from './regicide-enemy.svelte';
	import RegicideFooter from './regicide-footer.svelte';
	import {
		cardKey,
		createCardSelection,
		getSelected,
		isValidAttack,
		getAttackValue,
		getDefenseValue,
		shouldShowClubsDouble
	} from './regicide-card-state';
	import type { Card, RoomPlayer } from '$lib/platform/types/index';
	import type { RegicideUiState } from '$lib/games/regicide/ui-state';

	interface Props {
		uiState: RegicideUiState;
		myCards: readonly Card[];
		otherPlayers: readonly RoomPlayer[];
		playerIds: readonly string[];
		currentTurnIndex: number;
		onPlayCards: (cards: readonly Card[]) => void;
		onYield: () => void;
		onDefend: (cards: readonly Card[]) => void;
		onLeave: () => void;
	}

	let {
		uiState,
		myCards,
		otherPlayers,
		playerIds,
		currentTurnIndex,
		onPlayCards,
		onYield,
		onDefend,
		onLeave
	}: Props = $props();

	let selectedCards = createCardSelection();
	let showRules = $state(false);

	function toggleCard(card: Card) {
		const key = cardKey(card);
		if (selectedCards.has(key)) selectedCards.delete(key);
		else selectedCards.add(key);
	}

	const selected = $derived(getSelected(myCards, selectedCards));
	const validCombo = $derived(isValidAttack(selected));
	const attackValue = $derived(getAttackValue(validCombo, selected));
	const defenseValue = $derived(getDefenseValue(selected));
	const enemy = $derived(uiState.currentEnemy);
	const healthPct = $derived(
		enemy ? Math.max(0, (enemy.currentHealth / enemy.maxHealth) * 100) : 0
	);
	const showClubsDouble = $derived(shouldShowClubsDouble({ uiState, selected, valid: validCombo }));
	const canDefend = $derived(
		selected.length > 0 || uiState.defenseNeeded === 0 || myCards.length === 0
	);

	function handlePlay() {
		if (!validCombo) return;
		onPlayCards(selected);
		selectedCards.clear();
	}
	function handleDefend() {
		if (!canDefend) return;
		onDefend(selected);
		selectedCards.clear();
	}
	function handleYield() {
		onYield();
		selectedCards.clear();
	}
</script>

<nav class="border-b border-border px-4 py-2 flex justify-between items-center gap-2">
	<h1 class="text-sm font-bold whitespace-nowrap">Regicide</h1>
	<button class="cursor-pointer" onclick={() => (showRules = !showRules)}>
		<Badge variant="outline" class="whitespace-nowrap text-center"
			>{showRules ? 'Hide Rules' : 'Rules'}</Badge
		>
	</button>
	<div class="flex gap-2 text-xs text-muted-foreground">
		<span>Castle: {uiState.castleRemaining}</span><span>Tavern: {uiState.tavernSize}</span><span
			>Discard: {uiState.discardSize}</span
		>
	</div>
	{#if uiState.canPlay || uiState.isDefending}<Badge variant="success" class="whitespace-nowrap"
			>Your Turn</Badge
		>
	{:else}<Badge variant="secondary" class="whitespace-nowrap">Waiting...</Badge>{/if}
</nav>

{#if showRules}<RegicideRules />{/if}

<main class="flex-1 flex flex-col justify-between p-2">
	<div class="flex flex-wrap justify-center gap-x-4 gap-y-1 px-1 py-1">
		{#each otherPlayers as other (other.id)}
			{@const idx = playerIds.indexOf(other.id)}
			<div class="flex flex-col items-center min-w-[60px]">
				<span
					class="text-xs truncate max-w-[80px]"
					class:text-success={currentTurnIndex === idx}
					class:text-muted-foreground={currentTurnIndex !== idx}>{other.displayName}</span
				>
			</div>
		{/each}
	</div>

	{#if enemy}
		<RegicideEnemy
			{enemy}
			{healthPct}
			effectiveAttack={uiState.enemyEffectiveAttack}
			lastSuitPowers={uiState.lastSuitPowers}
		/>
	{:else if uiState.phase === 'victory'}
		<div class="flex flex-col items-center gap-2 py-8">
			<p class="text-2xl font-bold text-green-400">Victory!</p>
			<p class="text-sm text-muted-foreground">All enemies defeated</p>
		</div>
	{:else if uiState.phase === 'defeat'}
		<div class="flex flex-col items-center gap-2 py-8">
			<p class="text-2xl font-bold text-red-400">Defeat</p>
			<p class="text-sm text-muted-foreground">The kingdom has fallen</p>
		</div>
	{/if}

	{#if uiState.isDefending}
		<div class="text-center py-2">
			<p class="text-sm font-medium text-red-400">
				Defend! Discard cards worth {uiState.defenseNeeded} or more
			</p>
			{#if selected.length > 0}<p class="text-xs text-muted-foreground">
					Selected: {defenseValue} defense
				</p>{/if}
		</div>
	{/if}

	{#if uiState.canPlay && validCombo}
		<div class="text-center py-1">
			<p class="text-xs text-muted-foreground">
				Attack: {attackValue}
				{#if showClubsDouble}<span class="text-sky-300"> (x2 = {attackValue * 2})</span>{/if}
			</p>
		</div>
	{/if}

	<div class="border-t border-border pt-1">
		<div class="flex flex-wrap justify-center gap-1 p-2">
			{#each myCards as card (cardKey(card))}
				<PlayingCard
					{card}
					playable={uiState.canPlay || uiState.isDefending}
					selected={selectedCards.has(cardKey(card))}
					onclick={() => toggleCard(card)}
				/>
			{/each}
		</div>
	</div>
</main>

<RegicideFooter
	{uiState}
	{validCombo}
	{attackValue}
	{defenseValue}
	{canDefend}
	onPlay={handlePlay}
	onYield={handleYield}
	onDefend={handleDefend}
	{onLeave}
/>
