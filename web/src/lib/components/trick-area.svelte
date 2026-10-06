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
	const fadeDuration = 5000;

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

<div class="relative w-full max-w-2xl mx-auto rounded-3xl border border-emerald-500/20 bg-gradient-to-b from-emerald-950/25 via-emerald-950/15 to-transparent p-4 sm:p-6 shadow-inner flex flex-col items-center justify-center min-h-[160px] sm:min-h-[190px]">
	<div class="absolute inset-3 rounded-2xl border border-dashed border-emerald-500/15 pointer-events-none"></div>
	{#if visible.length === 0}
		<div class="flex flex-col items-center justify-center gap-2 py-4 text-emerald-400/50">
			<div class="w-10 h-14 rounded border border-dashed border-emerald-500/30 flex items-center justify-center bg-emerald-950/10">
				<span class="text-xs">♠</span>
			</div>
			<span class="text-xs font-medium tracking-wide">Waiting for lead...</span>
		</div>
	{:else}
		<div
			class="relative z-10 flex flex-wrap items-center justify-center gap-3 sm:gap-4"
			class:trick-fade-out={fading}
			style:animation-duration={fading ? `${fadeDuration}ms` : undefined}
		>
			{#each visible as play (play.playerId)}
				<div class="flex flex-col items-center gap-1.5">
					<div class="transform transition-transform hover:scale-105 duration-150 drop-shadow-md">
						<PlayingCard card={play.card} {gameId} {handType} {trumpSuit} size="sm" />
					</div>
					<span class="bg-card/90 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-foreground border border-border shadow-sm max-w-[85px] sm:max-w-[110px] truncate text-center">
						{playerNames[play.playerId] ?? '?'}
					</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.trick-fade-out {
		animation: fadeOut 5s ease-out forwards;
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
