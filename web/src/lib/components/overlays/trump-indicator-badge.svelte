<script lang="ts">
	import type { Card, Suit } from '$lib/platform/types/card';
	import type { EuchreRoundState } from '$lib/games/euchre/types';
	import type { WizardRoundState } from '$lib/games/wizard/types';
	import type { SpadesRoundState } from '$lib/games/spades/types';
	import type { HeartsRoundState } from '$lib/games/hearts/types';
	import type { CribbageUiState } from '$lib/games/cribbage/types';
	import type { GinUiState } from '$lib/games/gin-rummy/types';
	import { RANK_NAMES } from '$lib/platform/types/card';

	interface Props {
		gameId: string;
		trumpSuit?: string | null;
		gameSpecific?: unknown;
		handType?: string;
	}

	let { gameId, trumpSuit = null, gameSpecific, handType = '' }: Props = $props();

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

	function getEuchreBowers(suit: string | null): { rb: string; lb: string } {
		if (!suit) return { rb: 'None', lb: 'None' };
		switch (suit) {
			case 'spades':
				return { rb: 'J♠ (Highest)', lb: 'J♣ (2nd)' };
			case 'clubs':
				return { rb: 'J♣ (Highest)', lb: 'J♠ (2nd)' };
			case 'hearts':
				return { rb: 'J♥ (Highest)', lb: 'J♦ (2nd)' };
			case 'diamonds':
				return { rb: 'J♦ (Highest)', lb: 'J♥ (2nd)' };
			default:
				return { rb: 'None', lb: 'None' };
		}
	}

	const euchreState = $derived(gameId === 'euchre' ? (gameSpecific as EuchreRoundState) : null);
	const wizardState = $derived(gameId === 'wizard' ? (gameSpecific as WizardRoundState) : null);
	const spadesState = $derived(gameId === 'spades' ? (gameSpecific as SpadesRoundState) : null);
	const heartsState = $derived(gameId === 'hearts' ? (gameSpecific as HeartsRoundState) : null);
	const cribbageState = $derived(gameId === 'cribbage' ? (gameSpecific as CribbageUiState) : null);
	const ginState = $derived(gameId === 'gin-rummy' ? (gameSpecific as GinUiState) : null);

	const effectiveTrump = $derived(
		euchreState?.trumpSuit ?? wizardState?.trumpSuit ?? trumpSuit ?? null
	);

	const bowers = $derived(getEuchreBowers(effectiveTrump));
</script>

{#if gameId === 'euchre'}
	<div class="inline-flex items-center gap-1.5 sm:tall:gap-2.5 px-2.5 sm:tall:px-3 py-0.5 sm:tall:py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] sm:tall:text-xs text-amber-200 font-bold shadow-xs">
		<span class="flex items-center gap-1">
			<span>Trump:</span>
			<span class="capitalize {suitColors[effectiveTrump ?? ''] ?? ''}">
				{effectiveTrump ?? 'None'} {suitSymbols[effectiveTrump ?? ''] ?? ''}
			</span>
		</span>
		<span class="text-amber-400/40">•</span>
		<span class="text-amber-300">
			RB: <span class="text-white font-extrabold">{bowers.rb}</span>
		</span>
		<span class="text-amber-400/40">•</span>
		<span class="text-amber-300">
			LB: <span class="text-white font-extrabold">{bowers.lb}</span>
		</span>
		{#if euchreState?.goingAlone}
			<span class="text-amber-400/40">•</span>
			<span class="bg-amber-400 text-zinc-950 px-1.5 py-0.2 rounded-xs font-black uppercase text-[9px]">
				Alone
			</span>
		{/if}
	</div>
{:else if gameId === 'wizard'}
	<div class="inline-flex items-center gap-1.5 sm:tall:gap-2 px-2.5 sm:tall:px-3 py-0.5 sm:tall:py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-[10px] sm:tall:text-xs text-purple-200 font-bold shadow-xs">
		<span class="flex items-center gap-1">
			<span>Trump:</span>
			{#if wizardState?.trumpCard}
				{@const tc = wizardState.trumpCard}
				<span class="inline-flex items-center gap-0.5 px-1 py-0.2 bg-white text-zinc-950 rounded font-black text-[10px]">
					<span>{RANK_NAMES[tc.rank]}</span>
					<span class="{suitColors[tc.suit]}">{suitSymbols[tc.suit]}</span>
				</span>
			{:else if effectiveTrump}
				<span class="capitalize {suitColors[effectiveTrump]}">
					{effectiveTrump} {suitSymbols[effectiveTrump]}
				</span>
			{:else}
				<span class="text-muted-foreground">No Trump</span>
			{/if}
		</span>
		<span class="text-purple-400/40">•</span>
		<span class="text-purple-300">
			<span class="text-amber-300 font-black">W</span> (High) &gt; <span class="text-zinc-300 font-black">J</span> (Low)
		</span>
	</div>
{:else if gameId === 'spades'}
	<div class="inline-flex items-center gap-1.5 sm:tall:gap-2 px-2.5 sm:tall:px-3 py-0.5 sm:tall:py-1 rounded-full bg-zinc-800/80 border border-zinc-700 text-[10px] sm:tall:text-xs text-zinc-200 font-bold shadow-xs">
		<span class="flex items-center gap-1">
			<span class="text-emerald-400 font-black">♠</span>
			<span>Permanent Trump</span>
		</span>
		<span class="text-zinc-600">•</span>
		{#if spadesState?.spadesBroken}
			<span class="text-emerald-400 font-extrabold flex items-center gap-0.5">
				<span>Broken</span> ✓
			</span>
		{:else}
			<span class="text-amber-300 font-medium">Unbroken</span>
		{/if}
	</div>
{:else if gameId === 'hearts'}
	<div class="inline-flex items-center gap-1.5 sm:tall:gap-2 px-2.5 sm:tall:px-3 py-0.5 sm:tall:py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-[10px] sm:tall:text-xs text-rose-200 font-bold shadow-xs">
		<span class="flex items-center gap-1 text-rose-400 font-black">
			<span>♥</span>
			<span>Evasion</span>
		</span>
		<span class="text-rose-500/40">•</span>
		{#if heartsState?.heartsBroken}
			<span class="text-emerald-400 font-extrabold">Hearts Broken</span>
		{:else}
			<span class="text-amber-300 font-medium">Hearts Unbroken</span>
		{/if}
	</div>
{:else if gameId === 'cribbage' && cribbageState}
	<div class="inline-flex items-center gap-1.5 sm:tall:gap-2 px-2.5 sm:tall:px-3 py-0.5 sm:tall:py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] sm:tall:text-xs text-emerald-200 font-bold shadow-xs">
		<span>Peg Count:</span>
		<span class="font-extrabold text-white text-xs">{cribbageState.runningTotal} / 31</span>
		{#if cribbageState.starterCard}
			<span class="text-emerald-500/40">•</span>
			<span>Cut:</span>
			<span class="inline-flex items-center gap-0.5 px-1 bg-white text-zinc-950 rounded font-black text-[10px]">
				<span>{RANK_NAMES[cribbageState.starterCard.rank]}</span>
				<span class="{suitColors[cribbageState.starterCard.suit]}">{suitSymbols[cribbageState.starterCard.suit]}</span>
			</span>
			{#if cribbageState.hisHeels}
				<span class="bg-amber-400 text-zinc-950 px-1 py-0.2 rounded-xs font-black text-[9px]">His Heels +2</span>
			{/if}
		{/if}
	</div>
{:else if gameId === 'gin-rummy' && ginState}
	<div class="inline-flex items-center gap-1.5 sm:tall:gap-2 px-2.5 sm:tall:px-3 py-0.5 sm:tall:py-1 rounded-full bg-teal-500/15 border border-teal-500/30 text-[10px] sm:tall:text-xs text-teal-200 font-bold shadow-xs">
		<span>Deadwood:</span>
		<span class="font-black px-1.5 py-0.2 rounded {ginState.myDeadwoodPoints <= 10 ? 'bg-emerald-500 text-zinc-950' : 'bg-amber-500/20 text-amber-300'}">
			{ginState.myDeadwoodPoints} pts
		</span>
		{#if ginState.canKnock}
			<span class="text-teal-400/40">•</span>
			<span class="text-emerald-300 font-extrabold">{ginState.isGin ? 'GIN Ready!' : 'Knock Available'}</span>
		{/if}
	</div>
{/if}
