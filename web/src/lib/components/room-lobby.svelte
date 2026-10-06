<script lang="ts">
	import { Button } from '$lib/components/ui/button/index';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card/index';
	import { Badge } from '$lib/components/ui/badge/index';

	export interface LobbyPlayer {
		id: string;
		displayName: string;
		isHost?: boolean;
		isAi?: boolean;
	}

	interface Props {
		gameName: string;
		roomCode: string;
		players: readonly LobbyPlayer[];
		maxPlayers: number;
		isHost: boolean;
		isFull: boolean;
		onStart: () => void;
		onLeave: () => void;
		onAddAi: () => void;
	}

	let {
		gameName,
		roomCode,
		players,
		maxPlayers,
		isHost,
		isFull,
		onStart,
		onLeave,
		onAddAi
	}: Props = $props();

	let copied = $state(false);

	function copyCode() {
		navigator.clipboard.writeText(roomCode);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<main class="max-w-md mx-auto p-6 space-y-6 flex-1 w-full">
	<Card>
		<CardHeader>
			<CardTitle class="text-center">Waiting Room</CardTitle>
			<p class="text-center text-sm text-muted-foreground">{gameName}</p>
		</CardHeader>
		<CardContent class="space-y-5">
			<div class="text-center bg-muted/20 border border-border/50 rounded-lg p-3">
				<p class="text-xs text-muted-foreground mb-1 font-medium">Room Ticket / Code</p>
				<p class="text-sm font-mono font-bold tracking-wider break-all text-primary select-all">
					{roomCode.length > 20 ? `${roomCode.slice(0, 16)}...` : roomCode}
				</p>
				<Button variant="outline" size="sm" class="mt-2 text-xs h-7" onclick={copyCode}>
					{copied ? '✓ Copied to Clipboard' : 'Copy Room Invite'}
				</Button>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-center text-xs text-muted-foreground">
					<span class="font-medium">Players Joined</span>
					<Badge variant="outline" class="font-mono">
						{players.length}/{maxPlayers}
					</Badge>
				</div>
				<div class="space-y-1.5">
					{#each players as player (player.id)}
						<div class="flex items-center justify-between py-1.5 px-3 rounded-md bg-background border border-border/40 text-sm">
							<span class="flex items-center gap-1.5 font-medium">
								{player.displayName}
								{#if player.isHost}
									<span title="Host">👑</span>
								{/if}
							</span>
							{#if player.isHost}
								<Badge variant="secondary" class="text-[10px] py-0">Host</Badge>
							{:else if player.isAi}
								<Badge variant="outline" class="text-[10px] py-0 text-muted-foreground">AI</Badge>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			{#if isHost}
				<div class="space-y-2 pt-2">
					{#if !isFull}
						<Button variant="secondary" class="w-full" onclick={onAddAi}>
							+ Add AI Bot Player
						</Button>
					{/if}
					<Button class="w-full" onclick={onStart} disabled={!isFull}>
						{isFull ? 'Start Game' : `Need ${maxPlayers - players.length} more player${maxPlayers - players.length > 1 ? 's' : ''}`}
					</Button>
				</div>
			{:else}
				<p class="text-center text-xs text-muted-foreground animate-pulse py-2">
					Waiting for host to start the game...
				</p>
			{/if}
		</CardContent>
	</Card>
	<Button variant="ghost" class="w-full text-xs text-muted-foreground hover:text-destructive" onclick={onLeave}>
		← Leave Room & Back to Lobby
	</Button>
</main>
