<script lang="ts">
	import { Button } from '$lib/components/ui/button/index';
	import { getInitials } from '$lib/utils';
	import type { Card } from '$lib/platform/types/index';
	import { RANK_NAMES } from '$lib/platform/types/card';
	import type { RookUiState } from '$lib/games/rook/ui-state';

	interface Props {
		displayName: string;
		title?: string;
		onSignOut?: () => void;
		onNameChange?: (name: string) => void;
		showAdmin?: boolean;
		onAdmin?: () => void;
		roundLabel?: string;
		currentRound?: number;
		roundRules?: string;
		trumpSuit?: string | null;
		trumpCard?: Card | null;
		handType?: string;
		rookUi?: RookUiState | null;
	}

	let {
		displayName,
		title = 'Cards',
		onSignOut,
		onNameChange,
		showAdmin = false,
		onAdmin,
		roundLabel = '',
		currentRound = 0,
		roundRules = '',
		trumpSuit = null,
		trumpCard = null,
		handType = '',
		rookUi = null
	}: Props = $props();

	const suitSymbols: Record<string, string> = {
		hearts: '♥',
		diamonds: '♦',
		clubs: '♣',
		spades: '♠'
	};

	const suitColors: Record<string, string> = {
		hearts: 'text-rose-600',
		diamonds: 'text-blue-600',
		clubs: 'text-emerald-700',
		spades: 'text-zinc-950'
	};

	function formatPenalty(type: string): string {
		switch (type) {
			case 'NO_TRICKS': return 'No Tricks (+10)';
			case 'NO_HEARTS': return '♥ No Hearts (+10)';
			case 'NO_QUEENS': return '♛ No Queens (+25)';
			case 'NO_KING_SPADES': return '♠ No K♠ (+100)';
			case 'NO_LAST_TRICK': return 'No Last Trick (+100)';
			case 'COMBINATION': return 'All Penalties';
			default: return type;
		}
	}

	let showRules = $state(false);
	const MAX_NAME_LENGTH = 20;
	let editing = $state(false);
	let editValue = $state('');

	function startEdit() {
		editValue = displayName;
		editing = true;
	}

	function hasNameChanged(trimmed: string): boolean {
		return trimmed.length > 0 && trimmed !== displayName;
	}

	function confirmEdit() {
		const trimmed = editValue.trim().slice(0, MAX_NAME_LENGTH);
		if (hasNameChanged(trimmed)) onNameChange?.(trimmed);
		editing = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') confirmEdit();
		if (e.key === 'Escape') editing = false;
	}
</script>

<nav class="border-b border-border/80 bg-card/75 backdrop-blur-md px-3 sm:px-6 py-2 flex justify-between items-center sticky top-0 z-40 gap-2">
	<div class="flex items-center gap-2 sm:gap-2.5 shrink-0">
		<span class="text-sm sm:text-base font-black tracking-tight inline-flex items-center gap-1.5 leading-none">
			<span class="text-emerald-400 text-base sm:text-lg leading-none">♠</span>
			<span class="leading-none">{title}</span>
		</span>
		{#if roundLabel}
			<button
				class="cursor-pointer inline-flex items-center transition-transform hover:scale-105 active:scale-95 leading-none"
				onclick={() => (showRules = !showRules)}
				title="Click to view rules"
			>
				<span class="text-[11px] sm:text-xs font-bold px-2.5 py-1 rounded-full bg-background/60 border border-border/80 text-foreground hover:border-emerald-500/50 flex items-center gap-1 shadow-xs leading-none">
					<span class="opacity-70">H{currentRound + 1}:</span>
					<span class="font-extrabold truncate max-w-[75px] sm:max-w-[140px]">{roundLabel}</span>
					<span class="text-[10px] opacity-60">ⓘ</span>
				</span>
			</button>
		{:else if title !== 'Cards'}
			<span class="hidden sm:inline-flex items-center text-[10px] text-muted-foreground/70 uppercase tracking-widest border border-border/70 rounded px-1.5 py-0.5 leading-none font-bold">
				Cards
			</span>
		{/if}
	</div>

	<div class="flex items-center justify-center min-w-0">
		{#if trumpSuit}
			<div class="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] sm:text-xs font-bold shadow-xs">
				<span class="capitalize">Trump: {trumpSuit} {suitSymbols[trumpSuit] ?? ''}</span>
				{#if trumpCard}
					<div class="flex items-center gap-1 border-l border-amber-500/30 pl-1.5 sm:pl-2">
						<span class="text-[10px] sm:text-[11px] text-amber-300/80 font-medium">Cut:</span>
						<span class="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-white text-zinc-950 font-black text-[10px] sm:text-[11px] border border-zinc-300 shadow-xs leading-none">
							<span>{RANK_NAMES[trumpCard.rank]}</span>
							<span class="ml-0.5 {suitColors[trumpCard.suit] ?? 'text-zinc-950'}">{suitSymbols[trumpCard.suit]}</span>
						</span>
					</div>
				{/if}
			</div>
		{:else if handType}
			<div class="flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] sm:text-xs font-bold shadow-xs truncate">
				<span>{formatPenalty(handType)}</span>
			</div>
		{:else if rookUi && rookUi.trumpColor}
			<div class="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] sm:text-xs font-bold shadow-xs truncate capitalize">
				Trump: {rookUi.trumpColor}
			</div>
		{/if}
	</div>
	<div class="flex items-center gap-3">
		{#if editing}
			<div class="flex items-center gap-1.5 bg-background border border-emerald-500/70 rounded-full px-2.5 py-1 shadow-sm">
				<input
					class="bg-transparent border-none outline-none text-xs w-32 sm:w-44 px-2 text-foreground font-semibold"
					bind:value={editValue}
					maxlength={MAX_NAME_LENGTH}
					onkeydown={handleKeydown}
					onblur={confirmEdit}
				/>
				<button
					class="text-emerald-400 hover:text-emerald-300 text-xs px-1 font-bold cursor-pointer"
					onclick={confirmEdit}
					title="Save name"
				>
					✓
				</button>
			</div>
		{:else}
			<button
				class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/60 border border-border/80 text-xs text-foreground hover:border-border hover:bg-card transition-all cursor-pointer group shadow-xs leading-none"
				onclick={startEdit}
				title="Click to edit player name"
			>
				<div class="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-[10px] font-black leading-none shrink-0">
					{getInitials(displayName)}
				</div>
				<span class="font-semibold truncate max-w-[110px] sm:max-w-[160px] leading-none" title={displayName}>{displayName}</span>
				<span class="text-[11px] text-muted-foreground group-hover:text-emerald-400 opacity-70 leading-none">✎</span>
			</button>
		{/if}
		{#if showAdmin}
			<Button variant="ghost" size="sm" class="text-xs h-8" onclick={() => onAdmin?.()}>Users</Button>
		{/if}
		{#if onSignOut}
			<Button variant="ghost" size="sm" class="text-xs h-8" onclick={onSignOut}>Sign Out</Button>
		{/if}
	</div>
</nav>

{#if showRules && roundRules}
	<div class="border-b border-border/80 bg-muted/70 backdrop-blur-md px-4 sm:px-6 py-2 text-xs text-muted-foreground flex items-center justify-between animate-in fade-in duration-150">
		<span>{roundRules}</span>
		<button class="text-muted-foreground hover:text-foreground text-xs ml-2 cursor-pointer font-bold px-1.5 py-0.5 rounded hover:bg-card" onclick={() => (showRules = false)}>✕</button>
	</div>
{/if}
