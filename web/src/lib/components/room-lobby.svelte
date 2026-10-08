<script lang="ts">
	import { Button } from '$lib/components/ui/button/index';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card/index';
	import { Badge } from '$lib/components/ui/badge/index';
	import { isAiPlayer } from '$lib/platform/engine/ai-player';
	import { getGame } from '$lib/platform/engine/index';
	import type { GameRoom } from '$lib/platform/types/index';
	import { getInitials } from '$lib/utils';

	interface Props {
		room: GameRoom;
		isHost: boolean;
		isFull: boolean;
		onStart: () => void;
		onLeave: () => void;
		onAddAi: () => void;
		hideStart?: boolean;
	}

	let { room, isHost, isFull, onStart, onLeave, onAddAi, hideStart = false }: Props = $props();

	const gameName = $derived(getGame(room.gameDefinitionId).name);
	let copied = $state(false);

	function copyInviteLink() {
		const url = window.location.origin + window.location.pathname + '#code=' + room.code;
		navigator.clipboard.writeText(url);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<main class="max-w-lg self-center mx-auto p-4 sm:p-8 flex flex-col gap-6 flex-1 w-full justify-center">
	<Card class="border-border/80 bg-card/90 shadow-2xl backdrop-blur-md overflow-hidden rounded-2xl">
		<div class="h-2 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500 rounded-t-2xl shrink-0"></div>
		<CardHeader class="pb-3 text-center">
			<div class="inline-flex items-center justify-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold mx-auto mb-1 border border-emerald-500/20">
				<span>Waiting Room</span>
			</div>
			<CardTitle class="text-3xl font-black">{gameName}</CardTitle>
			<p class="text-sm text-muted-foreground">Invite friends or add AI opponents</p>
		</CardHeader>
		<CardContent class="gap-6 pt-2">
			<div class="rounded-2xl bg-background/70 border border-border/80 p-5 text-center flex flex-col gap-3">
				<p class="text-xs uppercase tracking-wider text-muted-foreground font-bold">Room Code</p>
				<p class="text-5xl font-mono font-black tracking-widest text-emerald-400 drop-shadow-md">{room.code}</p>
				<div class="flex items-center justify-center gap-2 pt-1">
					<Button
						variant="outline"
						size="sm"
						class="text-xs h-9 px-4 font-bold border-border/80 hover:border-emerald-500/50"
						onclick={copyInviteLink}
					>
						{copied ? '✓ Link Copied' : '🔗 Copy Invite Link'}
					</Button>
				</div>
			</div>

			<div class="flex flex-col gap-3">
				<div class="flex items-center justify-between text-xs text-muted-foreground font-semibold px-1">
					<span class="text-sm font-bold text-foreground">Players</span>
					<span class="bg-muted px-2.5 py-1 rounded-full text-xs font-mono font-bold">{room.players.length} of {room.maxPlayers}</span>
				</div>
				<div class="grid gap-2.5">
					{#each room.players as player, index (`${player.id}-${index}`)}
						<div class="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border/60 transition-all shadow-xs">
							<div class="flex items-center gap-3">
								<div class="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xs font-black text-emerald-300 shadow-inner">
									{getInitials(player.displayName)}
								</div>
								<span class="text-base font-bold text-foreground">{player.displayName}</span>
							</div>
							{#if player.isHost}
								<Badge variant="secondary" class="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-xs font-bold px-2.5 py-0.5">
									Host
								</Badge>
							{:else if isAiPlayer(player.id)}
								<Badge variant="outline" class="text-xs font-bold border-border/80 px-2.5 py-0.5">
									AI
								</Badge>
							{/if}
						</div>
					{/each}
					{#each Array.from({ length: Math.max(0, room.maxPlayers - room.players.length) }) as _, i (i)}
						<div class="flex items-center gap-3 p-3 rounded-xl border border-dashed border-border/60 text-muted-foreground/60 text-sm">
							<div class="w-9 h-9 rounded-full border border-dashed border-border/60 flex items-center justify-center text-xs opacity-50">
								+
							</div>
							<span class="font-medium">Waiting for player...</span>
						</div>
					{/each}
				</div>
			</div>

			{#if isHost}
				<div class="flex flex-col gap-3 pt-2">
					{#if !isFull}
						<Button variant="outline" class="w-full border-border/80 hover:bg-card text-xs sm:text-sm font-bold h-11 rounded-xl" onclick={onAddAi}>
							+ Add AI Player
						</Button>
					{/if}
					{#if !hideStart}
						<Button
							class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 h-13 shadow-xl shadow-emerald-950/50 text-base rounded-xl"
							onclick={onStart}
							disabled={!isFull}
						>
							{isFull ? '🚀 Start Game' : `Waiting for ${room.maxPlayers - room.players.length} more...`}
						</Button>
					{/if}
				</div>
			{:else}
				<div class="p-3 rounded-lg bg-background/40 border border-border/50 text-center">
					<p class="text-xs text-muted-foreground animate-pulse">Waiting for host to start the game...</p>
				</div>
			{/if}
		</CardContent>
	</Card>
	<Button variant="ghost" size="sm" class="w-full text-xs text-muted-foreground hover:text-destructive" onclick={onLeave}>
		Leave Room
	</Button>
</main>
