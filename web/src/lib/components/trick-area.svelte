<script lang="ts">
	import { cn, getFirstName, getLastPlayedCardPosition } from '$lib/utils';
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
		winnerName?: string | null;
		myId?: string;
		onCollectComplete?: () => void;
	}

	let {
		plays,
		lastCompleteTrick,
		playerNames,
		gameId = '',
		handType = '',
		trumpSuit = null,
		isRoundComplete = false,
		winnerId = null,
		winnerName = null,
		myId = '',
		onCollectComplete
	}: Props = $props();

	let containerEl: HTMLElement | null = $state(null);
	let animPhase = $state<'idle' | 'landing' | 'collecting'>('idle');
	let targetX = $state(0);
	let targetY = $state(-220);

	let handledTrickSig = '';
	const animatedCardKeys = new Set<string>();
	let settleTimer: ReturnType<typeof setTimeout> | null = null;
	let finishTimer: ReturnType<typeof setTimeout> | null = null;

	const trickSig = $derived(
		lastCompleteTrick.map((p) => `${p.playerId}:${p.card.suit}:${p.card.rank}`).join(',')
	);

	$effect(() => {
		const currentPlaysLen = plays.length;
		const currentSig = trickSig;
		const roundOver = isRoundComplete;

		if (currentPlaysLen > 0) {
			if (settleTimer) clearTimeout(settleTimer);
			if (finishTimer) clearTimeout(finishTimer);
			settleTimer = null;
			finishTimer = null;
			if (animPhase !== 'idle') {
				animPhase = 'idle';
			}
			return;
		}

		if (currentSig.length === 0) return;

		if (currentSig !== handledTrickSig) {
			handledTrickSig = currentSig;
			animPhase = 'landing';

			if (settleTimer) clearTimeout(settleTimer);
			if (finishTimer) clearTimeout(finishTimer);

			settleTimer = setTimeout(() => {
				if (typeof document !== 'undefined' && containerEl && winnerId) {
					const cRect = containerEl.getBoundingClientRect();
					const centerX = cRect.left + cRect.width / 2;
					const centerY = cRect.top + cRect.height / 2;

					const winnerPill = document.querySelector(`[data-player-id="${winnerId}"]`);
					if (winnerPill) {
						const wRect = winnerPill.getBoundingClientRect();
						targetX = Math.round((wRect.left + wRect.width / 2) - centerX);
						targetY = Math.round((wRect.top + wRect.height / 2) - centerY);
					} else {
						targetX = 0;
						targetY = -220;
					}
				}
				animPhase = 'collecting';
			}, 750);

			finishTimer = setTimeout(() => {
				animPhase = 'idle';
				animatedCardKeys.clear();
				settleTimer = null;
				finishTimer = null;
				onCollectComplete?.();
			}, 750 + 1100);
		}
	});

	function flyInFromBadge(node: HTMLElement, params: { playerId: string; cardKey: string }) {
		if (typeof document === 'undefined') return;
		if (animatedCardKeys.has(params.cardKey)) return;
		animatedCardKeys.add(params.cardKey);

		let originCenterX = 0;
		let originCenterY = 0;

		const isLocal = Boolean(myId && params.playerId === myId);
		const handPos = isLocal ? getLastPlayedCardPosition() : null;
		if (handPos) {
			originCenterX = handPos.x;
			originCenterY = handPos.y;
		} else {
			const pill = document.querySelector(`[data-player-id="${params.playerId}"]`);
			if (pill) {
				const pRect = pill.getBoundingClientRect();
				originCenterX = Math.round(pRect.left + pRect.width / 2);
				originCenterY = Math.round(pRect.top + pRect.height / 2);
			} else if (isLocal) {
				originCenterX = Math.round(window.innerWidth / 2);
				originCenterY = Math.round(window.innerHeight - 80);
			} else {
				return;
			}
		}

		const cRect = node.getBoundingClientRect();
		const dx = Math.round(originCenterX - (cRect.left + cRect.width / 2));
		const dy = Math.round(originCenterY - (cRect.top + cRect.height / 2));

		node.style.setProperty('--fly-from-x', `${dx}px`);
		node.style.setProperty('--fly-from-y', `${dy}px`);
		node.classList.add('fly-in-active');

		const t = setTimeout(() => {
			node.classList.remove('fly-in-active');
		}, 460);
		return {
			destroy() {
				clearTimeout(t);
			}
		};
	}

	const visible = $derived(
		plays.length > 0
			? plays
			: (animPhase === 'landing' || animPhase === 'collecting' || isRoundComplete)
				? lastCompleteTrick
				: []
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
	{#if animPhase === 'collecting'}
		<div class="relative z-20 flex flex-col items-center gap-3 animate-in fade-in duration-150">
			{#if winnerName}
				<div class="px-4 py-1.5 rounded-full bg-emerald-950/95 border-2 border-emerald-400 text-emerald-200 font-black text-xs sm:text-sm shadow-xl shadow-emerald-950/60 backdrop-blur-md animate-in zoom-in-95 duration-150 whitespace-nowrap">
					<span>{winnerName} won the trick!</span>
				</div>
			{/if}
			<div
				class="trick-deck-flyer relative w-[64px] h-[94px] sm:w-[84px] sm:h-[122px] mx-auto shadow-2xl"
				style:--target-x={`${targetX}px`}
				style:--target-y={`${targetY}px`}
			>
				{#each lastCompleteTrick as play, idx (play.playerId)}
					{@const isWinnerCard = play.playerId === winnerId}
					<div
						class="absolute inset-0 rounded-lg shadow-md"
						style:transform={`rotate(${(idx - (lastCompleteTrick.length - 1) / 2) * 5}deg) translate(${idx * 1.5}px, ${idx * -1.5}px)`}
						style:z-index={isWinnerCard ? 20 : idx}
					>
						<div class={cn('w-full h-full rounded-lg', isWinnerCard && 'ring-2 ring-amber-400 border border-amber-400 shadow-amber-950/40')}>
							<PlayingCard card={play.card} {gameId} {handType} {trumpSuit} size="md" />
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:else if visible.length === 0}
		<div class="flex flex-col items-center justify-center gap-2 py-4 text-emerald-400/60 select-none">
			<div class="w-12 h-16 rounded-xl border-2 border-dashed border-emerald-500/30 flex items-center justify-center bg-emerald-950/20 shadow-inner">
				<span class="text-sm font-bold opacity-75">♠</span>
			</div>
			<span class="text-xs font-semibold tracking-wider uppercase text-emerald-300/70">Waiting for lead</span>
		</div>
	{:else}
		<div class="relative z-10 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
			{#each visible as play (play.playerId)}
				{@const cardKey = `${play.card.suit}-${play.card.rank}`}
				<div
					use:flyInFromBadge={{ playerId: play.playerId, cardKey }}
					class="flex flex-col items-center gap-1.5 transition-all"
				>
					<div class="transform transition-transform hover:scale-105 duration-200 drop-shadow-xl">
						<PlayingCard card={play.card} {gameId} {handType} {trumpSuit} size="md" />
					</div>
					<span
						class="bg-card/90 backdrop-blur-md px-2 py-0.5 rounded-full text-xs font-bold text-foreground border border-border/80 shadow-md max-w-[64px] sm:max-w-[84px] truncate text-center block w-full"
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
	.trick-deck-flyer {
		pointer-events: none;
		animation: flyDeckToWinner 1100ms cubic-bezier(0.25, 0.9, 0.35, 1) forwards;
	}
	@keyframes flyDeckToWinner {
		0% {
			transform: translate(0, 0) scale(1);
			opacity: 1;
		}
		28% {
			transform: translate(0, -8px) scale(1.04);
			opacity: 1;
		}
		100% {
			transform: translate(var(--target-x, 0px), var(--target-y, -220px)) scale(0.18);
			opacity: 0;
		}
	}

	:global(.fly-in-active) {
		animation: flyCardFromBadge 420ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
		will-change: transform, opacity;
	}

	@keyframes flyCardFromBadge {
		0% {
			transform: translate(var(--fly-from-x, 0px), var(--fly-from-y, -200px)) scale(0.35) rotate(-6deg);
			opacity: 0.2;
		}
		50% {
			opacity: 1;
		}
		100% {
			transform: translate(0, 0) scale(1) rotate(0deg);
			opacity: 1;
		}
	}
</style>
