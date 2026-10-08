<script lang="ts">
	import { cn, getFirstName } from '$lib/utils';
	import PlayingCard from './playing-card.svelte';
	import type { TrickPlay } from '$lib/platform/engine/index';

	interface Props {
		plays: readonly TrickPlay[];
		lastCompleteTrick: readonly TrickPlay[];
		playerNames: Record<string, string>;
		gameId?: string;
		handType?: string;
		trumpSuit?: string | null;
		isRoundComplete?: boolean;
		winnerId?: string | null;
	}

	let {
		plays,
		lastCompleteTrick,
		playerNames,
		gameId = '',
		handType = '',
		trumpSuit = null,
		isRoundComplete = false,
		winnerId = null
	}: Props = $props();

	let containerEl: HTMLElement | null = $state(null);
	let collecting = $state(false);
	let prevTrickLen = $state(0);
	let targetX = $state(0);
	let targetY = $state(-220);

	const shouldCollect = $derived(prevTrickLen > 0 && lastCompleteTrick.length > 0 && !isRoundComplete);
	const collectDuration = 1000;
	$effect(() => {
		if (plays.length > 0) {
			prevTrickLen = plays.length;
			collecting = false;
			return;
		}
		if (!shouldCollect) return;
		prevTrickLen = 0;

		// Calculate delta vector (dx, dy) from center of trick area to winner's avatar pill
		if (typeof document !== 'undefined' && containerEl && winnerId) {
			const winnerPill = document.querySelector(`[data-player-id="${winnerId}"]`);
			if (winnerPill) {
				const cRect = containerEl.getBoundingClientRect();
				const wRect = winnerPill.getBoundingClientRect();
				targetX = Math.round((wRect.left + wRect.width / 2) - (cRect.left + cRect.width / 2));
				targetY = Math.round((wRect.top + wRect.height / 2) - (cRect.top + cRect.height / 2));
			} else {
				targetX = 0;
				targetY = -220;
			}
		}

		collecting = true;
		const t = setTimeout(() => (collecting = false), collectDuration);
		return () => clearTimeout(t);
	});

	const visible = $derived(
		plays.length > 0 ? plays : (collecting || isRoundComplete) ? lastCompleteTrick : []
	);
</script>

<div
	bind:this={containerEl}
	class={cn(
		"relative w-full max-w-3xl mx-auto rounded-[2.5rem] border-2 border-emerald-500/25 bg-[radial-gradient(ellipse_at_center,rgba(6,78,59,0.35)_0%,rgba(2,44,34,0.15)_50%,transparent_80%)] shadow-[inset_0_2px_28px_rgba(0,0,0,0.5),0_12px_36px_rgba(0,0,0,0.35)] flex flex-col items-center justify-center transition-all",
		isRoundComplete
			? "min-h-[130px] sm:min-h-[160px] p-2.5 sm:p-4"
			: "min-h-[190px] sm:min-h-[230px] p-4 sm:p-8"
	)}
	style:--target-x={`${targetX}px`}
	style:--target-y={`${targetY}px`}
>
	<div class="absolute inset-2.5 rounded-[2.2rem] border border-dashed border-emerald-500/20 pointer-events-none"></div>
	{#if visible.length === 0}
		<div class="flex flex-col items-center justify-center gap-2 py-4 text-emerald-400/60 select-none">
			<div class="w-12 h-16 rounded-xl border-2 border-dashed border-emerald-500/30 flex items-center justify-center bg-emerald-950/20 shadow-inner">
				<span class="text-sm font-bold opacity-75">♠</span>
			</div>
			<span class="text-xs font-semibold tracking-wider uppercase text-emerald-300/70">Waiting for lead</span>
		</div>
	{:else}
		<div
			class="relative z-10 flex flex-wrap items-center justify-center gap-3 sm:gap-4"
			class:trick-collecting={collecting}
		>
			{#each visible as play, idx (play.playerId)}
				<div
					class="trick-card-col flex flex-col items-center gap-1.5 transition-all"
					style:--stack-rot={`${(idx - (visible.length - 1) / 2) * 6}deg`}
					style:--stack-offset-x={`${(idx - (visible.length - 1) / 2) * 4}px`}
					style:--stack-offset-y={`${idx * -3}px`}
					style:z-index={idx}
				>
					<div class="transform transition-transform hover:scale-105 duration-200 drop-shadow-xl">
						<PlayingCard card={play.card} {gameId} {handType} {trumpSuit} size="md" />
					</div>
					<span
						class="trick-player-label bg-card/90 backdrop-blur-md px-2 py-0.5 rounded-full text-xs font-bold text-foreground border border-border/80 shadow-md max-w-[64px] sm:max-w-[84px] truncate text-center block w-full transition-opacity duration-150"
						title={playerNames[play.playerId] ?? '?'}
					>
						{getFirstName(playerNames[play.playerId] ?? '?')}
					</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.trick-collecting {
		pointer-events: none;
	}
	.trick-collecting .trick-player-label {
		opacity: 0;
	}
	.trick-collecting .trick-card-col {
		animation: collectCard 1000ms cubic-bezier(0.2, 0.9, 0.3, 1) forwards;
	}
	@keyframes collectCard {
		0% {
			transform: translate(0, 0) scale(1) rotate(0deg);
			opacity: 1;
		}
		28% {
			/* Cards gather and stack together into a neat pack */
			transform: translate(var(--stack-offset-x, 0px), var(--stack-offset-y, 0px)) scale(0.92) rotate(var(--stack-rot, 0deg));
			opacity: 1;
		}
		100% {
			/* Stack shrinks and flies into the winner's pill */
			transform: translate(var(--target-x, 0px), var(--target-y, -220px)) scale(0.18) rotate(var(--stack-rot, 0deg));
			opacity: 0;
		}
	}
</style>
