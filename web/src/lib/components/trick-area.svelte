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

<div class="flex items-center justify-center gap-2 min-h-28 p-2">
	{#if visible.length === 0}
		<p class="text-muted-foreground text-sm">Waiting for lead...</p>
	{:else}
		<div
			class="flex items-center gap-2"
			class:trick-fade-out={fading}
			style:animation-duration={fading ? `${fadeDuration}ms` : undefined}
		>
			{#each visible as play (play.playerId)}
				<div class="flex flex-col items-center gap-0.5 max-w-[66px] sm:max-w-[80px]">
					<PlayingCard card={play.card} {gameId} {handType} {trumpSuit} size="sm" />
					<span class="text-[10px] text-muted-foreground truncate w-full text-center">
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
