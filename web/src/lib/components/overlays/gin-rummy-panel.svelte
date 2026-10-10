<script lang="ts">
	import { Button } from '$lib/components/ui/button/index';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card/index';
	import { Badge } from '$lib/components/ui/badge/index';
	import type { GinUiState, Meld } from '$lib/games/gin-rummy/types';
	import { RANK_NAMES } from '$lib/platform/types/card';

	interface Props {
		uiState: GinUiState;
		playerNames: Record<string, string>;
		playerIds: readonly string[];
		myId: string;
		onKnock?: () => void;
		onGin?: () => void;
	}

	let { uiState, playerNames, playerIds, myId, onKnock, onGin }: Props = $props();

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

	const isMyTurn = $derived(uiState.turnPlayerId === myId);
</script>

<div class="w-full max-w-md mx-auto animate-in fade-in duration-200">
	<Card class="border-border/80 bg-card/90 shadow-xl backdrop-blur-md overflow-hidden rounded-xl sm:tall:rounded-2xl border">
		<div class="h-1 sm:tall:h-1.5 w-full bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500 shrink-0"></div>
		<CardHeader class="p-2 sm:tall:px-4 sm:tall:pt-3 sm:tall:pb-2">
			<div class="flex items-center justify-between">
				<Badge variant="outline" class="text-[10px] sm:tall:text-xs font-bold py-0.5 px-2 border-teal-500/30 bg-teal-500/10 text-teal-300">
					Gin Rummy — {uiState.phase === 'draw' ? 'Draw Card' : uiState.phase === 'discard' ? 'Discard Card' : 'Round Concluded'}
				</Badge>
				<div class="flex items-center gap-1.5 text-[10px] sm:tall:text-xs text-muted-foreground">
					<span>Stock: <strong class="text-foreground">{uiState.stockCount}</strong></span>
					{#if uiState.topDiscard}
						{@const td = uiState.topDiscard}
						<span class="text-border">•</span>
						<span>Discard:</span>
						<span class="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-white text-zinc-950 font-black text-[10px] shadow-xs">
							<span>{RANK_NAMES[td.rank]}</span>
							<span class="{suitColors[td.suit]}">{suitSymbols[td.suit]}</span>
						</span>
					{/if}
				</div>
			</div>

			<!-- Deadwood Summary Banner -->
			<div class="flex items-center justify-between mt-1.5 p-1.5 sm:tall:p-2 rounded-lg bg-background/60 border border-border/80 gap-2">
				<div class="flex items-center gap-2">
					<div class="flex flex-col">
						<span class="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Deadwood</span>
						<span class="text-base sm:tall:text-lg font-black text-white tabular-nums leading-none">
							{uiState.myDeadwoodPoints} <span class="text-xs text-muted-foreground font-semibold">pts</span>
						</span>
					</div>
					<Badge
						variant="outline"
						class="text-[9px] sm:tall:text-[10px] font-black uppercase py-0.5 px-1.5 {uiState.isGin
							? 'bg-emerald-500 text-zinc-950 border-emerald-400'
							: uiState.canKnock
								? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
								: 'bg-muted/40 text-muted-foreground border-border/60'}"
					>
						{uiState.isGin ? 'GIN (0 Deadwood)' : uiState.canKnock ? 'Knock Eligible (&le;10)' : 'Unmelded'}
					</Badge>
				</div>

				<!-- Knock / Gin Action Buttons -->
				{#if isMyTurn && uiState.phase === 'discard'}
					<div class="flex items-center gap-1">
						{#if uiState.isGin}
							<Button
								size="sm"
								class="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-[11px] h-7 px-2.5 shadow-md animate-pulse cursor-pointer"
								onclick={() => onGin?.()}
							>
								GIN! (+25)
							</Button>
						{:else if uiState.canKnock}
							<Button
								size="sm"
								class="bg-teal-600 hover:bg-teal-500 text-white font-bold text-[11px] h-7 px-2.5 shadow-sm cursor-pointer"
								onclick={() => onKnock?.()}
							>
								Knock
							</Button>
						{/if}
					</div>
				{/if}
			</div>
		</CardHeader>
		<CardContent class="p-2 sm:tall:p-4 pt-0 sm:tall:pt-0 flex flex-col gap-2">
			<!-- Melds Detected -->
			<div class="flex flex-col gap-1 max-h-[75px] sm:tall:max-h-none overflow-y-auto">
				{#if uiState.myMelds.length > 0}
					<div class="flex flex-wrap items-center gap-1.5 text-[10px]">
						<span class="text-muted-foreground font-semibold shrink-0">Melds:</span>
						{#each uiState.myMelds as m, i (i)}
							<div class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted/60 border border-border/70 text-[10px] font-bold">
								<span class="text-teal-400 uppercase text-[8px] font-black mr-0.5">{m.type}:</span>
								{#each m.cards as c, ci (ci)}
									<span class="font-bold text-foreground">
										{RANK_NAMES[c.rank]}<span class="{suitColors[c.suit]}">{suitSymbols[c.suit]}</span>
									</span>
								{/each}
							</div>
						{/each}
					</div>
				{:else}
					<span class="text-[10px] text-muted-foreground/80 italic text-center">
						No melds formed yet (collect 3+ of same rank or 3+ sequence in same suit)
					</span>
				{/if}

				{#if uiState.myDeadwood.length > 0}
					<div class="flex flex-wrap items-center gap-1 text-[10px] pt-1 border-t border-border/40">
						<span class="text-muted-foreground font-medium shrink-0">Deadwood cards:</span>
						{#each uiState.myDeadwood as c, ci (ci)}
							<span class="inline-flex items-center px-1 py-0.2 rounded bg-background/80 border border-border/60 text-[10px] font-medium text-foreground">
								{RANK_NAMES[c.rank]}<span class="{suitColors[c.suit]} ml-0.5">{suitSymbols[c.suit]}</span>
							</span>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Round Scored Summary -->
			{#if uiState.scoringResult}
				{@const sr = uiState.scoringResult}
				<div class="p-1.5 rounded bg-background/70 border border-border/60 text-[11px] flex flex-col gap-0.5">
					<div class="flex justify-between items-center font-bold">
						<span class="text-emerald-400">{playerNames[sr.winnerId] ?? sr.winnerId} Won Round!</span>
						<span class="text-white font-extrabold">+{sr.pointsWon} pts</span>
					</div>
					<p class="text-[10px] text-muted-foreground">{sr.description}</p>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
