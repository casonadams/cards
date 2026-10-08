<script lang="ts">
	import PlayingCard from './playing-card.svelte';
	import type { TrickPlay } from '$lib/platform/engine/index';

	interface Props {
		plays: readonly TrickPlay[];
		lastCompleteTrick: readonly TrickPlay[];
		playerNames: Record<string, string>;
		gameId?: string;
		handType?: string;
		trumpSuit?: string | null;
	}

	let {
		plays,
		lastCompleteTrick,
		playerNames,
		gameId = '',
		handType = '',
		trumpSuit = null
	}: Props = $props();

	let fading = $state(false);
	let prevTrickLen = $state(0);

	const shouldFade = $derived(prevTrickLen > 0 && lastCompleteTrick.length > 0);
	const fadeDuration = 1800;
	$effect(() => {
		if (plays.length > 0) {
			prevTrickLen = plays.length;
			fading = false;
			return;
		}
		if (!shouldFade) return;
		prevTrickLen = 0;
		fading = true;
		const t = setTimeout(() => (fading = false), fadeDuration);
		return () => clearTimeout(t);
	});

	const visible = $derived(plays.length > 0 ? plays : fading ? lastCompleteTrick : []);
</script>

<div class="relative w-full max-w-3xl mx-auto rounded-[2.5rem] border-2 border-emerald-500/25 bg-[radial-gradient(ellipse_at_center,rgba(6,78,59,0.35)_0%,rgba(2,44,34,0.15)_50%,transparent_80%)] p-4 sm:p-8 shadow-[inset_0_2px_28px_rgba(0,0,0,0.5),0_12px_36px_rgba(0,0,0,0.35)] flex flex-col items-center justify-center min-h-[190px] sm:min-h-[230px]">
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
			class:trick-fade-out={fading}
			style:animation-duration={fading ? `${fadeDuration}ms` : undefined}
		>
			{#each visible as play (play.playerId)}
				<div class="flex flex-col items-center gap-1.5 transition-all">
					<div class="transform transition-transform hover:scale-105 duration-200 drop-shadow-xl">
						<PlayingCard card={play.card} {gameId} {handType} {trumpSuit} size="md" />
					</div>
					<span class="bg-card/90 backdrop-blur-md px-3 py-0.5 rounded-full text-xs font-bold text-foreground border border-border/80 shadow-md max-w-[95px] sm:max-w-[125px] truncate text-center">
						{playerNames[play.playerId] ?? '?'}
					</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.trick-fade-out {
		animation: fadeOut 1.8s ease-out forwards;
	}
	@keyframes fadeOut {
		0% {
			opacity: 1;
			transform: scale(1);
		}
		100% {
			opacity: 0;
			transform: scale(0.85);
		}
	}
</style>
