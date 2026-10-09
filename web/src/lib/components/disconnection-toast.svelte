<script lang="ts">
	import { Button } from '$lib/components/ui/button/index';

	export interface DisconnectNotice {
		readonly id: string;
		readonly playerId: string;
		readonly playerName: string;
		readonly type: 'disconnected' | 'reconnected' | 'host_disconnecting';
		readonly timestamp: number;
		readonly isAiControlled?: boolean;
		readonly actingHostName?: string;
		readonly remainingSeconds?: number;
	}

	interface Props {
		notices: readonly DisconnectNotice[];
		isHost: boolean;
		onPlayTurn: (playerId: string) => void;
		onToggleAi: (playerId: string) => void;
		onDismissNotice: (id: string) => void;
	}

	let { notices, isHost, onPlayTurn, onToggleAi, onDismissNotice }: Props = $props();
</script>

{#if notices.length > 0}
	<div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-2 sm:px-0">
		{#each notices as notice (notice.id)}
			<div
				class="pointer-events-auto rounded-xl p-3.5 border shadow-xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-3 flex flex-col gap-2.5 {notice.type === 'reconnected'
					? 'bg-emerald-950/90 border-emerald-600/40 text-emerald-100 shadow-emerald-950/40'
					: 'bg-amber-950/90 border-amber-600/40 text-amber-100 shadow-amber-950/40'}"
				role="alert"
			>
				<div class="flex items-center justify-between gap-2">
					<div class="flex items-center gap-2">
						<span class="text-base" aria-hidden="true">
							{notice.type === 'reconnected' ? '✅' : '⚠️'}
						</span>
						<span class="text-xs font-bold leading-tight">
							{#if notice.type === 'disconnected'}
								<span class="font-extrabold text-amber-300">{notice.playerName}</span> disconnected
							{:else if notice.type === 'host_disconnecting'}
								Host disconnected — <span class="font-extrabold text-amber-300">{notice.actingHostName || 'Temporary Host'}</span> is acting host
							{:else}
								<span class="font-extrabold text-emerald-300">{notice.playerName}</span> reconnected!
							{/if}
						</span>
					</div>
					<button
						type="button"
						class="text-xs text-muted-foreground hover:text-foreground px-1 py-0.5 rounded transition-colors"
						onclick={() => onDismissNotice(notice.id)}
						aria-label="Close notification"
					>
						✕
					</button>
				</div>

				{#if notice.type === 'host_disconnecting'}
					<div class="flex items-center justify-between pt-1 border-t border-amber-700/30 text-xs text-amber-200/90 font-mono">
						<span class="flex items-center gap-1.5">
							<span class="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
							Reclaim window:
						</span>
						<span class="font-bold text-amber-300 bg-amber-900/50 px-2 py-0.5 rounded">
							{notice.remainingSeconds ?? 30}s remaining
						</span>
					</div>
				{:else if notice.type === 'disconnected'}
					{#if isHost}
						<div class="flex items-center gap-2 pt-1 border-t border-amber-700/30">
							<Button
								size="sm"
								variant="outline"
								class="h-7 text-xs bg-amber-900/60 border-amber-500/40 text-amber-200 hover:bg-amber-800/80 hover:text-amber-100 flex-1 font-semibold"
								onclick={() => onPlayTurn(notice.playerId)}
							>
								Play Turn
							</Button>
							<Button
								size="sm"
								variant="default"
								class="h-7 text-xs {notice.isAiControlled
									? 'bg-emerald-700 hover:bg-emerald-600 text-white'
									: 'bg-amber-600 hover:bg-amber-500 text-white'} flex-1 font-semibold"
								onclick={() => onToggleAi(notice.playerId)}
							>
								{notice.isAiControlled ? 'AI Active ✓' : 'Turn AI On'}
							</Button>
						</div>
					{:else}
						<p class="text-[11px] text-amber-300/80">
							Waiting for {notice.playerName} to reconnect. Host can play turn or enable AI.
						</p>
					{/if}
				{/if}
			</div>
		{/each}
	</div>
{/if}
