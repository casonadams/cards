<script lang="ts">
	import { Button } from '$lib/components/ui/button/index';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card/index';
	import { Badge } from '$lib/components/ui/badge/index';
	import { arrangeAlternatingTeams } from '$lib/games/spades/teams';
	import type { SpadesGameMode } from '$lib/games/spades/types';

	interface PlayerInfo {
		readonly id: string;
		readonly displayName: string;
	}

	interface Props {
		open: boolean;
		hostId: string;
		players: readonly PlayerInfo[];
		playerNames: Record<string, string>;
		onConfirm: (reorderedPlayerIds: string[], mode: SpadesGameMode) => void;
		onCancel: () => void;
	}

	let { open, hostId, players, playerNames, onConfirm, onCancel }: Props = $props();

	let modeType = $state<'teams' | 'solo'>('teams');
	let selectedTeammateIds = $state<string[]>([]);

	const isSixPlayer = $derived(players.length === 6);
	const requiredTeammates = $derived(isSixPlayer ? 2 : 1);
	const selectablePlayers = $derived(players.filter((p) => p.id !== hostId));
	const isTeamsComplete = $derived(selectedTeammateIds.length === requiredTeammates);
	const isActionReady = $derived(modeType === 'solo' || isTeamsComplete);

	const team1Ids = $derived([hostId, ...selectedTeammateIds]);
	const team2Ids = $derived(players.map((p) => p.id).filter((id) => !team1Ids.includes(id)));
	const alternatingIds = $derived(
		arrangeAlternatingTeams({
			hostId,
			allPlayerIds: players.map((p) => p.id),
			selectedTeammateIds
		})
	);

	function togglePlayer(id: string) {
		if (selectedTeammateIds.includes(id)) {
			selectedTeammateIds = selectedTeammateIds.filter((p) => p !== id);
		} else {
			if (selectedTeammateIds.length < requiredTeammates) {
				selectedTeammateIds = [...selectedTeammateIds, id];
			} else if (requiredTeammates === 1) {
				selectedTeammateIds = [id];
			}
		}
	}

	function handleConfirm() {
		if (!isActionReady) return;
		if (modeType === 'solo') {
			onConfirm(players.map((p) => p.id), '4p_solo');
		} else {
			const mode: SpadesGameMode = isSixPlayer ? '6p_teams' : '4p_teams';
			onConfirm(alternatingIds, mode);
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:tall:p-4 animate-in fade-in duration-200"
		role="dialog"
		aria-modal="true"
		aria-label="Spades Game Setup"
	>
		<Card class="w-full max-w-lg border-emerald-500/30 bg-card/95 shadow-2xl overflow-hidden rounded-xl sm:tall:rounded-2xl">
			<div class="h-1.5 w-full bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-500 rounded-t-xl shrink-0"></div>
			<CardHeader class="p-3 sm:tall:p-5 pb-2 sm:tall:pb-3 text-center">
				<div class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-400 text-xl font-black mx-auto mb-2 border border-emerald-500/30 shadow-inner">
					♠
				</div>
				<CardTitle class="text-xl sm:tall:text-2xl font-black tracking-tight text-foreground">
					{isSixPlayer
						? 'Choose Your Teammates'
						: modeType === 'teams'
							? 'Choose Your Partner'
							: 'Solo Spades (Cutthroat)'}
				</CardTitle>
				<p class="text-xs text-muted-foreground mt-1">
					{#if isSixPlayer}
						Select <strong class="text-emerald-400">2</strong> players to join <strong class="text-foreground">Team 1</strong> with you.
					{:else if modeType === 'teams'}
						Select <strong class="text-emerald-400">1</strong> player to join <strong class="text-foreground">Team 1</strong> with you.
					{:else}
						Every player for themselves. Individual bids, individual bags, and independent scores.
					{/if}
				</p>
			</CardHeader>

			<CardContent class="p-3 sm:tall:p-5 pt-0 sm:tall:pt-0 flex flex-col gap-3">
				<!-- 4-Player Mode Toggle: Teams (2v2) vs Solo (Cutthroat) -->
				{#if !isSixPlayer}
					<div class="flex gap-1.5 p-1 rounded-xl bg-background/60 border border-border/70">
						<button
							type="button"
							class="flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer border {modeType === 'teams'
								? 'bg-emerald-600 border-emerald-500 text-white shadow-xs'
								: 'border-transparent text-muted-foreground hover:text-foreground'}"
							onclick={() => (modeType = 'teams')}
						>
							👥 Teams (2v2)
						</button>
						<button
							type="button"
							class="flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer border {modeType === 'solo'
								? 'bg-indigo-600 border-indigo-500 text-white shadow-xs'
								: 'border-transparent text-muted-foreground hover:text-foreground'}"
							onclick={() => (modeType = 'solo')}
						>
							👤 Solo (Cutthroat)
						</button>
					</div>
				{/if}

				{#if modeType === 'teams' || isSixPlayer}
					<!-- Candidate selection cards -->
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
						{#each selectablePlayers as p (p.id)}
							{@const isSelected = selectedTeammateIds.includes(p.id)}
							<button
								type="button"
								class="flex items-center justify-between p-2.5 rounded-xl border-2 transition-all cursor-pointer text-left {isSelected
									? 'bg-emerald-950/40 border-emerald-500 text-foreground shadow-md'
									: 'bg-muted/40 border-border/70 text-muted-foreground hover:border-emerald-500/50 hover:text-foreground'}"
								onclick={() => togglePlayer(p.id)}
							>
								<div class="flex items-center gap-2">
									<div
										class="w-5 h-5 rounded-md flex items-center justify-center text-xs font-black border transition-colors {isSelected
											? 'bg-emerald-500 border-emerald-400 text-zinc-950'
											: 'border-border/80 bg-background/50'}"
									>
										{isSelected ? '✓' : ''}
									</div>
									<span class="font-bold text-xs sm:tall:text-sm">{p.displayName}</span>
								</div>
								<Badge
									variant={isSelected ? 'default' : 'outline'}
									class="text-[10px] py-0 px-1.5 {isSelected ? 'bg-emerald-600 text-white' : 'border-border/60 text-muted-foreground'}"
								>
									{isSelected ? 'Partner' : 'Opponent'}
								</Badge>
							</button>
						{/each}
					</div>

					<!-- Live Preview of Teams & Alternating Seating -->
					<div class="rounded-xl bg-secondary/40 border border-border/60 p-2.5 flex flex-col gap-2 text-xs">
						<div class="flex items-center justify-between font-bold text-[11px] text-muted-foreground uppercase tracking-wider">
							<span>Table Seating Order (Alternating)</span>
							<span class="text-emerald-400 lowercase font-normal">{isTeamsComplete ? 'Ready' : `pick ${requiredTeammates - selectedTeammateIds.length} more`}</span>
						</div>

						<div class="grid grid-cols-2 gap-2">
							<div class="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/30 flex flex-col gap-1">
								<span class="font-bold text-[10px] text-emerald-400 uppercase tracking-wider">Team 1</span>
								<ul class="text-[11px] space-y-0.5 text-foreground">
									{#each team1Ids as id (id)}
										<li class="flex items-center gap-1">
											<span class="text-emerald-400 text-[10px]">•</span>
											<span>{playerNames[id] ?? id} {id === hostId ? '(You)' : ''}</span>
										</li>
									{/each}
								</ul>
							</div>

							<div class="p-2 rounded-lg bg-indigo-950/30 border border-indigo-500/30 flex flex-col gap-1">
								<span class="font-bold text-[10px] text-indigo-400 uppercase tracking-wider">Team 2</span>
								<ul class="text-[11px] space-y-0.5 text-foreground">
									{#each team2Ids as id (id)}
										<li class="flex items-center gap-1">
											<span class="text-indigo-400 text-[10px]">•</span>
											<span>{playerNames[id] ?? id}</span>
										</li>
									{/each}
								</ul>
							</div>
						</div>

						{#if isTeamsComplete}
							<div class="pt-1 border-t border-border/40 text-[10px] text-muted-foreground flex flex-wrap items-center gap-1">
								<span class="font-semibold text-foreground">Seats:</span>
								{#each alternatingIds as id, i (id)}
									<span class="px-1 py-0.5 rounded {i % 2 === 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-indigo-500/20 text-indigo-300'} font-medium">
										{i + 1}. {playerNames[id] ?? id}
									</span>
								{/each}
							</div>
						{/if}
					</div>
				{:else}
					<!-- Solo Mode Info Card -->
					<div class="rounded-xl bg-indigo-950/25 border border-indigo-500/30 p-4 flex flex-col gap-2.5 text-xs text-foreground">
						<div class="flex items-center gap-2 text-indigo-400 font-bold text-sm">
							<span>👤 Cutthroat Solo Rules</span>
						</div>
						<ul class="space-y-1.5 text-muted-foreground text-xs list-disc list-inside">
							<li><strong class="text-foreground">Individual contracts:</strong> each player bids and earns points only from tricks they take.</li>
							<li><strong class="text-foreground">Individual bags:</strong> 10 overtricks accumulated by a player incurs a -100 point penalty.</li>
							<li><strong class="text-foreground">Seating:</strong> standard clockwise seating around the table.</li>
						</ul>
					</div>
				{/if}

				<!-- Actions -->
				<div class="flex gap-2 pt-1">
					<Button
						variant="outline"
						class="flex-1 font-bold text-xs h-10 rounded-xl border border-border/80 hover:bg-card"
						onclick={onCancel}
					>
						Cancel
					</Button>
					<Button
						class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs h-10 rounded-xl shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
						disabled={!isActionReady}
						onclick={handleConfirm}
					>
						{modeType === 'solo' ? 'Start Solo Game & Deal' : 'Confirm Teams & Deal'}
					</Button>
				</div>
			</CardContent>
		</Card>
	</div>
{/if}
