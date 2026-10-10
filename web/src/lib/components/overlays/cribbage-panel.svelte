<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card/index';
	import { Badge } from '$lib/components/ui/badge/index';
	import type { CribbageUiState } from '$lib/games/cribbage/types';
	import { RANK_NAMES } from '$lib/platform/types/card';

	interface Props {
		uiState: CribbageUiState;
		playerNames: Record<string, string>;
		playerIds: readonly string[];
		myId: string;
	}

	let { uiState, playerNames, playerIds, myId }: Props = $props();

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

	const isMeDealer = $derived(uiState.dealerId === myId);
	const dealerName = $derived(playerNames[uiState.dealerId] ?? uiState.dealerId);
	const nonDealerName = $derived(playerNames[uiState.nonDealerId] ?? uiState.nonDealerId);
</script>

<div class="w-full max-w-md mx-auto animate-in fade-in duration-200">
	<Card class="border-border/80 bg-card/90 shadow-xl backdrop-blur-md overflow-hidden rounded-xl sm:tall:rounded-2xl border">
		<div class="h-1 sm:tall:h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-amber-500 shrink-0"></div>
		<CardHeader class="p-2 sm:tall:px-4 sm:tall:pt-3 sm:tall:pb-2">
			<div class="flex items-center justify-between">
				<Badge variant="outline" class="text-[10px] sm:tall:text-xs font-bold py-0.5 px-2 border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
					Cribbage — {uiState.phase === 'cribDiscard' ? 'Crib Discard' : uiState.phase === 'pegging' ? 'Pegging to 31' : 'Show & Scoring'}
				</Badge>
				<span class="text-[10px] sm:tall:text-xs text-muted-foreground">
					Dealer: <strong class="text-amber-300 font-extrabold">{dealerName}</strong>
					{#if isMeDealer}
						<span class="text-emerald-400 ml-0.5">(You)</span>
					{/if}
				</span>
			</div>

			<!-- Pegging Counter & Starter Card -->
			<div class="flex items-center justify-between mt-1.5 p-1.5 sm:tall:p-2 rounded-lg bg-background/60 border border-border/80 gap-2">
				<div class="flex items-center gap-2">
					<div class="flex flex-col">
						<span class="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Count</span>
						<span class="text-base sm:tall:text-lg font-black text-white tabular-nums leading-none">
							{uiState.runningTotal} <span class="text-xs text-muted-foreground font-semibold">/ 31</span>
						</span>
					</div>
					<!-- Mini Progress Bar -->
					<div class="w-16 sm:tall:w-24 h-2 bg-muted/60 rounded-full overflow-hidden border border-border/80">
						<div
							class="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-200"
							style="width: {Math.min(100, (uiState.runningTotal / 31) * 100)}%"
						></div>
					</div>
				</div>

				{#if uiState.starterCard}
					{@const sc = uiState.starterCard}
					<div class="flex items-center gap-1.5 border-l border-border/70 pl-2">
						<span class="text-[10px] text-muted-foreground font-medium">Starter:</span>
						<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white text-zinc-950 font-black text-xs shadow-xs border">
							<span>{RANK_NAMES[sc.rank]}</span>
							<span class="{suitColors[sc.suit]}">{suitSymbols[sc.suit]}</span>
						</span>
						{#if uiState.hisHeels}
							<span class="text-[9px] bg-amber-400 text-zinc-950 font-black px-1 rounded-xs">Heels +2</span>
						{/if}
					</div>
				{/if}
			</div>
		</CardHeader>
		<CardContent class="p-2 sm:tall:p-4 pt-0 sm:tall:pt-0 flex flex-col gap-2">
			<!-- Pegging Cards Sequence -->
			{#if uiState.currentCountCards.length > 0}
				<div class="flex items-center gap-1 overflow-x-auto py-1">
					<span class="text-[10px] text-muted-foreground font-medium shrink-0">Played:</span>
					{#each uiState.currentCountCards as c, i (i)}
						<span class="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-muted/80 text-foreground font-black text-[11px] border border-border/60">
							<span>{RANK_NAMES[c.rank]}</span>
							<span class="{suitColors[c.suit]}">{suitSymbols[c.suit]}</span>
						</span>
					{/each}
				</div>
			{/if}

			<!-- Phase Instructions -->
			{#if uiState.phase === 'cribDiscard'}
				<p class="text-[10px] sm:tall:text-xs text-muted-foreground text-center">
					Select and play 2 cards from your hand to place into the dealer's crib ({uiState.cribCount}/4 cards in crib).
				</p>
			{:else if uiState.phase === 'pegging'}
				<p class="text-[10px] sm:tall:text-xs text-muted-foreground text-center">
					Play cards keeping count &le; 31. Score 15s (2), pairs (2/6/12), runs (1/card), 31 (2), Go (1).
				</p>
			{:else if uiState.handBreakdowns}
				<!-- Show Scoring Breakdown -->
				<div class="flex flex-col gap-1 text-[11px] max-h-[80px] sm:tall:max-h-none overflow-y-auto">
					{#each Object.entries(uiState.handBreakdowns) as [pid, b] (pid)}
						<div class="flex items-center justify-between p-1 rounded bg-background/50 border border-border/50">
							<span class="font-bold text-foreground">{playerNames[pid] ?? pid}:</span>
							<span class="text-emerald-400 font-extrabold">{b.total} pts ({b.descriptions.join(', ') || '0'})</span>
						</div>
					{/each}
					{#if uiState.cribBreakdown}
						<div class="flex items-center justify-between p-1 rounded bg-background/50 border border-border/50">
							<span class="font-bold text-amber-300">Crib ({dealerName}):</span>
							<span class="text-amber-400 font-extrabold">{uiState.cribBreakdown.total} pts ({uiState.cribBreakdown.descriptions.join(', ') || '0'})</span>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Current Scores to 121 -->
			<div class="flex justify-between items-center text-[10px] sm:tall:text-xs font-bold text-muted-foreground pt-1 border-t border-border/50">
				<span>{nonDealerName}: <strong class="text-foreground">{uiState.playerPegScores[uiState.nonDealerId] ?? 0}</strong> / 121 pts</span>
				<span>{dealerName}: <strong class="text-foreground">{uiState.playerPegScores[uiState.dealerId] ?? 0}</strong> / 121 pts</span>
			</div>
		</CardContent>
	</Card>
</div>
