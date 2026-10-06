<script lang="ts">
	import { Button } from '$lib/components/ui/button/index';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card/index';
	import { Badge } from '$lib/components/ui/badge/index';
	import { isAiPlayer } from '$lib/platform/engine/ai-player';
	import { getGame } from '$lib/platform/engine/index';
	import type { GameRoom } from '$lib/platform/types/index';

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
</script>

<main class="max-w-md mx-auto p-8 space-y-6 flex-1">
	<Card>
		<CardHeader>
			<CardTitle class="text-center">Waiting Room</CardTitle>
			<p class="text-center text-sm text-muted-foreground">{gameName}</p>
		</CardHeader>
		<CardContent class="space-y-4">
			<div class="text-center">
				<p class="text-sm text-muted-foreground mb-1">Share this code</p>
				<p class="text-3xl font-mono font-bold tracking-widest">{room.code}</p>
			</div>

			<div class="space-y-2">
				<p class="text-sm text-muted-foreground">
					Players ({room.players.length}/{room.maxPlayers})
				</p>
				{#each room.players as player (player.id)}
					<div class="flex items-center justify-between py-1 border-b border-border/50">
						<span>{player.displayName}</span>
						{#if player.isHost}
							<Badge variant="secondary">Host</Badge>
						{:else if isAiPlayer(player.id)}
							<Badge variant="outline">AI</Badge>
						{/if}
					</div>
				{/each}
			</div>

			{#if isHost}
				{#if !isFull}
					<Button variant="secondary" class="w-full" onclick={onAddAi}>Add AI Player</Button>
				{/if}
				{#if !hideStart}
					<Button class="w-full" onclick={onStart} disabled={!isFull}>
						{isFull ? 'Start Game' : `Need ${room.maxPlayers - room.players.length} more`}
					</Button>
				{/if}
			{:else}
				<p class="text-center text-sm text-muted-foreground">Waiting for host to start...</p>
			{/if}
		</CardContent>
	</Card>
	<Button variant="ghost" class="w-full" onclick={onLeave}>Leave Room</Button>
</main>
