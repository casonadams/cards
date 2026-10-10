<script lang="ts">
	import type { GameSummary } from '$lib/platform/engine/index';
	import { Button } from '$lib/components/ui/button/index';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card/index';
	import { Badge } from '$lib/components/ui/badge/index';

	interface Props {
		games: readonly GameSummary[];
		selectedGameId: string;
		playerCount: number;
		loading?: boolean;
		hasValidName?: boolean;
		onSelectGame: (id: string) => void;
		onSelectPlayerCount: (count: number) => void;
		onCreateTable: () => void;
	}

	let {
		games,
		selectedGameId,
		playerCount,
		loading = false,
		hasValidName = false,
		onSelectGame,
		onSelectPlayerCount,
		onCreateTable
	}: Props = $props();

	interface GameRulePreview {
		readonly category: 'Trick-Taking' | 'Melding & Strategy';
		readonly tag: string;
		readonly deck: string;
		readonly trump: string;
		readonly scoring: string;
		readonly winCondition: string;
		readonly summary: string;
	}

	const GAME_RULES: Record<string, GameRulePreview> = {
		'canadian-salad': {
			category: 'Trick-Taking',
			tag: 'Penalty Avoidance',
			deck: 'Standard 52-card deck',
			trump: 'No trump throughout all 6 rounds',
			scoring: 'Avoid trick penalties: T1 (+10), Hearts (+10 ea), Queens (+25 ea), K♠ (+100), Last Trick (+100), All Penalties',
			winCondition: 'Lowest penalty score after 6 rounds wins',
			summary: 'A 6-round penalty avoidance game where players try not to collect specific penalty cards or tricks.'
		},
		'oh-well': {
			category: 'Trick-Taking',
			tag: 'Contract Bidding',
			deck: 'Standard 52-card deck',
			trump: 'Cut card determines trump suit (or No Trump)',
			scoring: 'Exact bids: +10 pts bonus + 1 pt per trick. Missed bids score 0.',
			winCondition: 'Highest cumulative score wins. Dealer hook enforces total bids != hand size.',
			summary: 'Progressive hand sizes where players must predict the exact number of tricks they will take.'
		},
		hearts: {
			category: 'Trick-Taking',
			tag: 'Classic Evasion',
			deck: 'Standard 52-card deck (2♣ leads trick 1)',
			trump: 'No trump. Hearts cannot lead until broken.',
			scoring: 'Hearts = +1 pt each, Queen of Spades = +13 pts. Shooting the Moon gives -26 pts (or +26 to opponents).',
			winCondition: 'Game ends when any player reaches 100 points. Lowest score wins.',
			summary: 'Evade trick penalty cards (Hearts and Queen of Spades) or shoot the moon to penalize all opponents.'
		},
		spades: {
			category: 'Trick-Taking',
			tag: 'Partnership & Nil',
			deck: 'Standard 52 cards (4P) or 104-card double deck (6P, 2nd card duplicate wins ties)',
			trump: 'Spades are permanent trump. Spades cannot lead until broken.',
			scoring: 'Contract made = 10 pts/trick + 1 pt/bag. 10 bags penalty = -100 pts. Nil = +100/-100, Blind Nil = +200/-200.',
			winCondition: 'First team/player to reach 500 points wins.',
			summary: 'Bid and make your contract with permanent spade trumps. Protect partner Nil bids and manage bag accumulation.'
		},
		euchre: {
			category: 'Trick-Taking',
			tag: 'Bowers & Loners',
			deck: 'Truncated 24-card deck (9 through Ace in all suits)',
			trump: 'Dynamic Bowers: Right Bower (Jack of trump) is highest; Left Bower (Jack of same-color suit) is 2nd highest.',
			scoring: '3–4 tricks = 1 pt; 5 tricks (March) = 2 pts; Lone March = 4 pts; Euchring makers = 2 pts.',
			winCondition: 'First team to reach 10 points wins. Support for "Go Alone" declarations.',
			summary: 'Fast-paced trick-taking where Jack Bowers dominate trump play and calling team must make 3+ tricks.'
		},
		wizard: {
			category: 'Trick-Taking',
			tag: 'Wizards & Jesters',
			deck: '60 cards: 52 standard + 4 Wizards (high trump) + 4 Jesters (lowest card)',
			trump: 'Cut card reveals trump suit; Wizard cut = dealer choice; Jester cut = No Trump.',
			scoring: 'Exact bid = +20 pts + 10 pts/trick taken; Missed bid = -10 pts per trick difference.',
			winCondition: 'Highest total score across all progressive rounds wins.',
			summary: 'Special Wizards always beat standard cards; Jesters always lose. Exact bid accuracy is crucial.'
		},
		cribbage: {
			category: 'Melding & Strategy',
			tag: 'Pegging & Show',
			deck: 'Standard 52-card deck (6-card deal -> 4-card hand + 2 to crib)',
			trump: 'No trump. Starter card cut (Jack cut awards "His Heels" +2 to dealer).',
			scoring: 'Pegging to 31 (15s, pairs, runs, 31 for 2, Go). Show scoring: 15s (2), pairs (2), runs, flushes, knobs (1).',
			winCondition: 'First player to reach 121 points wins instantly.',
			summary: 'Classic 2-player pegging and hand-building duel. Alternating dealer crib creates strategic discard decisions.'
		},
		'gin-rummy': {
			category: 'Melding & Strategy',
			tag: 'Deadwood & Melds',
			deck: 'Standard 52-card deck (10 cards each)',
			trump: 'No trump. Discard pile and stock draw.',
			scoring: 'Knock with <=10 deadwood. Gin bonus (+25 pts), Big Gin (+31 pts), Undercut bonus (+25 pts to defender).',
			winCondition: 'First player to reach 100 points wins.',
			summary: 'Collect sets (3-4 of rank) and runs (3+ in suit). Minimize unmelded deadwood cards to knock or declare Gin.'
		}
	};

	let showRulesPreview = $state(true);

	const selectedGame = $derived(games.find((g) => g.id === selectedGameId));
	const currentRule = $derived(selectedGameId ? GAME_RULES[selectedGameId] : null);

	const playerOptions = $derived.by(() => {
		if (!selectedGame) return [4];
		const opts: number[] = [];
		for (let n = selectedGame.minPlayers; n <= selectedGame.maxPlayers; n++) {
			opts.push(n);
		}
		return opts;
	});
</script>

<Card class="border-border/80 bg-card/90 shadow-xl backdrop-blur-md">
	<CardHeader class="pb-3">
		<CardTitle class="text-lg font-black flex items-center justify-between">
			<span class="flex items-center gap-2">
				<span>Table Selector</span>
				<Badge variant="outline" class="text-[10px] font-bold border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
					{games.length} Games
				</Badge>
			</span>
			<span class="text-xs text-muted-foreground font-semibold">Choose Game and Players</span>
		</CardTitle>
	</CardHeader>
	<CardContent class="gap-4">
		<!-- Game Selection Grid: Must use grid grid-cols-2 and button containing span.block.text-base for Playwright locators -->
		<div class="grid grid-cols-2 gap-2.5 sm:gap-3">
			{#each games as game (game.id)}
				{@const rule = GAME_RULES[game.id]}
				{@const isSelected = selectedGameId === game.id}
				<button
					type="button"
					class="rounded-xl sm:rounded-2xl border-2 p-3 sm:p-4 text-left transition-all cursor-pointer relative overflow-hidden group {isSelected
						? 'border-emerald-500 bg-emerald-950/35 shadow-md shadow-emerald-950/20 ring-1 ring-emerald-500/30'
						: 'border-border/80 bg-background/50 hover:border-emerald-500/40 hover:bg-card/90'}"
					onclick={() => onSelectGame(game.id)}
				>
					<div class="flex items-start justify-between gap-1">
						<div class="min-w-0 flex-1">
							<span class="block text-base font-extrabold text-foreground group-hover:text-emerald-400 transition-colors truncate">
								{game.name}
							</span>
							{#if rule}
								<span class="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-sm mt-0.5 {rule.category === 'Trick-Taking' ? 'bg-amber-500/15 text-amber-300' : 'bg-blue-500/15 text-blue-300'}">
									{rule.category}
								</span>
							{/if}
						</div>
						<span
							class="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all {isSelected
								? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/40 shadow-xs'
								: 'border border-border/80 text-transparent'}"
						>
							✓
						</span>
					</div>
					<div class="flex items-center justify-between text-xs text-muted-foreground mt-1.5 font-medium">
						<span>
							{game.minPlayers === game.maxPlayers
								? `${game.minPlayers} players`
								: `${game.minPlayers}–${game.maxPlayers} players`}
						</span>
						{#if rule}
							<span class="text-[10px] text-muted-foreground/75 truncate max-w-[85px] text-right">
								{rule.tag}
							</span>
						{/if}
					</div>
				</button>
			{/each}
		</div>

		<!-- Rules Preview Accordion -->
		{#if currentRule && selectedGame}
			<div class="rounded-xl border border-border/70 bg-background/50 overflow-hidden text-xs transition-all">
				<button
					type="button"
					class="w-full px-3 py-2 flex items-center justify-between bg-muted/30 hover:bg-muted/50 cursor-pointer font-bold text-foreground text-left"
					onclick={() => (showRulesPreview = !showRulesPreview)}
				>
					<div class="flex items-center gap-1.5">
						<span class="text-emerald-400">ⓘ</span>
						<span>Rules Preview: <span class="text-emerald-400">{selectedGame.name}</span></span>
					</div>
					<span class="text-muted-foreground text-[10px] uppercase font-bold">
						{showRulesPreview ? 'Hide ▲' : 'Show ▼'}
					</span>
				</button>
				{#if showRulesPreview}
					<div class="p-3 flex flex-col gap-1.5 text-muted-foreground border-t border-border/60 bg-card/40">
						<p class="text-foreground/90 font-medium leading-relaxed">{currentRule.summary}</p>
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1 pt-1 border-t border-border/40 text-[11px]">
							<div>
								<span class="font-bold text-emerald-400">Deck:</span> {currentRule.deck}
							</div>
							<div>
								<span class="font-bold text-emerald-400">Trump:</span> {currentRule.trump}
							</div>
							<div class="sm:col-span-2">
								<span class="font-bold text-emerald-400">Scoring:</span> {currentRule.scoring}
							</div>
							<div class="sm:col-span-2">
								<span class="font-bold text-emerald-400">Win Condition:</span> {currentRule.winCondition}
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Player Count Selector -->
		<div class="flex flex-col p-2.5 bg-background/60 rounded-xl border border-border/80 gap-2">
			<div class="flex items-center justify-between px-1">
				<span class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Players</span>
				<span class="text-[11px] text-muted-foreground">
					{selectedGame?.name ?? ''} supports {selectedGame?.minPlayers === selectedGame?.maxPlayers
						? `${selectedGame?.minPlayers} players`
						: `${selectedGame?.minPlayers}–${selectedGame?.maxPlayers} players`}
				</span>
			</div>
			<div class="flex items-center gap-1.5 w-full">
				{#each playerOptions as n (n)}
					<button
						type="button"
						data-player-count={n}
						aria-label={`${n} Players`}
						class="flex-1 h-9 rounded-lg text-xs font-bold transition-all cursor-pointer text-center flex items-center justify-center {playerCount === n
							? 'bg-emerald-500 text-zinc-950 font-black shadow-sm'
							: 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}"
						onclick={() => onSelectPlayerCount(n)}
					>
						{n}
					</button>
				{/each}
			</div>
		</div>

		<!-- Action CTA -->
		<Button
			class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 h-12 shadow-lg shadow-emerald-950/40 text-base rounded-xl cursor-pointer"
			onclick={onCreateTable}
			disabled={loading || !hasValidName}
		>
			{loading ? 'Creating...' : !hasValidName ? 'Enter Name Above to Play' : 'Create Table'}
		</Button>
	</CardContent>
</Card>
