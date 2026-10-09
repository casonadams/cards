<script lang="ts">
	import { Button } from '$lib/components/ui/button/index';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card/index';

	export interface ActiveGameSession {
		readonly code: string;
		readonly gameDefinitionId: string;
		readonly gameName: string;
		readonly hostId?: string;
		readonly timestamp: number;
	}

	interface Props {
		open: boolean;
		session: ActiveGameSession | null;
		onRejoin: (code: string) => void;
		onDismiss: () => void;
	}

	let { open, session, onRejoin, onDismiss }: Props = $props();

	function formatTimeAgo(ts: number): string {
		const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
		if (diffSec < 60) return `${diffSec}s ago`;
		const diffMin = Math.floor(diffSec / 60);
		if (diffMin < 60) return `${diffMin}m ago`;
		const diffHr = Math.floor(diffMin / 60);
		return `${diffHr}h ago`;
	}
</script>

{#if open && session}
	<div
		class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
		role="dialog"
		aria-modal="true"
		aria-label="Active Game Found"
	>
		<Card class="w-full max-w-md border-emerald-500/30 bg-card/95 shadow-2xl overflow-hidden rounded-xl">
			<div class="h-1.5 w-full bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 rounded-t-xl shrink-0"></div>
			<CardHeader class="text-center pb-2 pt-6">
				<div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 text-2xl font-black mx-auto mb-2 border border-emerald-500/20 shadow-inner">
					🃏
				</div>
				<CardTitle class="text-2xl font-black tracking-tight text-foreground">Active Game Found</CardTitle>
				<p class="text-xs text-muted-foreground mt-1">
					You have an active table <span class="font-mono font-bold text-emerald-400">{session.code}</span> in progress.
				</p>
			</CardHeader>
			<CardContent class="flex flex-col gap-5 pt-2">
				<div class="rounded-lg bg-secondary/50 border border-border/60 p-3.5 flex flex-col gap-2">
					<div class="flex items-center justify-between">
						<span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Game</span>
						<span class="text-sm font-bold text-foreground">{session.gameName}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Table Code</span>
						<span class="font-mono font-bold text-sm tracking-widest text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
							{session.code}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Active</span>
						<span class="text-xs text-muted-foreground">{formatTimeAgo(session.timestamp)}</span>
					</div>
				</div>

				<div class="flex flex-col gap-2.5 pt-1">
					<Button
						variant="default"
						class="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-2.5 shadow-md shadow-emerald-900/30"
						onclick={() => onRejoin(session.code)}
					>
						Rejoin Table {session.code}
					</Button>
					<Button
						variant="ghost"
						class="w-full text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60"
						onclick={onDismiss}
					>
						Abandon &amp; Start Fresh
					</Button>
				</div>
			</CardContent>
		</Card>
	</div>
{/if}
