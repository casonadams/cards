<script lang="ts">
	import { cn } from '$lib/utils';
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

<div class="border-b border-border/80 bg-card/60 backdrop-blur-md px-4 py-2.5 flex justify-between items-center gap-3">
	<div class="flex items-center gap-2">
		<button
			class="cursor-pointer inline-flex items-center gap-1.5 transition-transform hover:scale-105 active:scale-95"
			onclick={() => (showRules = !showRules)}
		>
			<Badge variant="outline" class="whitespace-nowrap font-medium text-xs py-1.5 px-3.5 bg-background/50 hover:bg-accent border-border/80">
				{showRules ? 'Hide Rules' : 'Regicide Rules ⓘ'}
			</Badge>
		</button>
		<div class="hidden sm:flex items-center gap-2 text-xs text-muted-foreground ml-2">
			<span class="px-2.5 py-0.5 rounded-full bg-muted/60 font-medium">Castle: {uiState.castleRemaining}</span>
			<span class="px-2.5 py-0.5 rounded-full bg-muted/60 font-medium">Tavern: {uiState.tavernSize}</span>
			<span class="px-2.5 py-0.5 rounded-full bg-muted/60 font-medium">Discard: {uiState.discardSize}</span>
		</div>
	</div>
	<div class="flex items-center gap-2">
		{#if uiState.canPlay || uiState.isDefending}
			<Badge variant="success" class="whitespace-nowrap px-3.5 py-1.5 text-xs font-bold shadow-sm shadow-emerald-500/20">
				<span class="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
				{uiState.isDefending ? 'Defend!' : 'Your Turn'}
			</Badge>
		{:else}
			<Badge variant="secondary" class="whitespace-nowrap px-3 py-1.5 text-xs font-medium text-muted-foreground bg-secondary/60">
				Waiting...
			</Badge>
		{/if}
	</div>
</div>

{#if showRules}<RegicideRules />{/if}

<main class="flex-1 flex flex-col justify-between p-2 sm:p-4 max-w-5xl self-center mx-auto w-full gap-3">
	<div class="flex flex-wrap justify-center items-center gap-2.5 sm:gap-4 px-2 py-1 max-w-4xl mx-auto w-full shrink-0">
		{#each otherPlayers as other (other.id)}
			{@const idx = playerIds.indexOf(other.id)}
			{@const isTurn = currentTurnIndex === idx}
			<div
				class={cn(
					'flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl border transition-all duration-200 text-xs backdrop-blur-md shadow-md',
					isTurn
						? 'bg-emerald-500/20 border-emerald-500/70 text-emerald-200 shadow-[0_0_18px_rgba(16,185,129,0.35)] ring-2 ring-emerald-500/50 scale-105'
						: 'bg-card/85 border-border/80 text-muted-foreground hover:border-border hover:bg-card'
				)}
			>
				<div
					class={cn(
						'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 shadow-inner',
						isTurn ? 'bg-emerald-400 text-zinc-950 font-black' : 'bg-muted text-foreground'
					)}
				>
					{other.displayName.slice(0, 2).toUpperCase()}
				</div>
				<span class={cn('font-semibold truncate max-w-[85px] sm:max-w-[120px]', isTurn && 'text-emerald-300 font-bold')}>
					{other.displayName}
				</span>
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

	<div class="w-full border-t border-border/70 bg-card/40 backdrop-blur-md shrink-0 overflow-visible pt-3 pb-2 rounded-t-xl">
		<div class="flex flex-wrap justify-center gap-2 p-2">
			{#each myCards as card (cardKey(card))}
				<div class="transform transition-transform hover:-translate-y-2">
					<PlayingCard
						{card}
						playable={uiState.canPlay || uiState.isDefending}
						selected={selectedCards.has(cardKey(card))}
						onclick={() => toggleCard(card)}
					/>
				</div>
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
