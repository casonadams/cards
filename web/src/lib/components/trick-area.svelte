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
	let animPhase = $state<'idle' | 'landing' | 'gathering' | 'flying'>('idle');
	let targetX = $state(0);
	let targetY = $state(-220);

	let handledTrickSig = '';
	const animatedCardKeys = new Set<string>();
	let gatherTimer: ReturnType<typeof setTimeout> | null = null;
	let flyTimer: ReturnType<typeof setTimeout> | null = null;
	let finishTimer: ReturnType<typeof setTimeout> | null = null;

	const totalSlots = $derived(Math.max(3, Object.keys(playerNames).length || 4));
	const useTwoRows = $derived(totalSlots > 4);

	interface SlotItem {
		slotIdx: number;
		rowIdx: number;
		colIdx: number;
		rowLength: number;
	}

	const rows = $derived.by<SlotItem[][]>(() => {
		if (!useTwoRows) {
			return [
				Array.from({ length: totalSlots }, (_, i) => ({
					slotIdx: i,
					rowIdx: 0,
					colIdx: i,
					rowLength: totalSlots
				}))
			];
		}
		const row1Len = 4;
		const row2Len = totalSlots - 4;
		const row1: SlotItem[] = Array.from({ length: row1Len }, (_, i) => ({
			slotIdx: i,
			rowIdx: 0,
			colIdx: i,
			rowLength: row1Len
		}));
		const row2: SlotItem[] = Array.from({ length: row2Len }, (_, i) => ({
			slotIdx: i + 4,
			rowIdx: 1,
			colIdx: i,
			rowLength: row2Len
		}));
		return [row1, row2];
	});

	function getGatherCoords(item: SlotItem) {
		const pitchMobile = useTwoRows ? 50 : 60;
		const pitchDesktop = useTwoRows ? 72 : 90;
		const yOffsetMobile = useTwoRows ? (item.rowIdx === 0 ? -38 : 38) : 0;
		const yOffsetDesktop = useTwoRows ? (item.rowIdx === 0 ? -54 : 54) : 0;

		const xMobile = Math.round(-1 * (item.colIdx - (item.rowLength - 1) / 2) * pitchMobile);
		const xDesktop = Math.round(-1 * (item.colIdx - (item.rowLength - 1) / 2) * pitchDesktop);
		const yMobile = -1 * yOffsetMobile;
		const yDesktop = -1 * yOffsetDesktop;
		const rot = Math.round((item.slotIdx - (totalSlots - 1) / 2) * 5);

		return { xMobile, xDesktop, yMobile, yDesktop, rot };
	}
	const trickSig = $derived(
		lastCompleteTrick.map((p) => `${p.playerId}:${p.card.suit}:${p.card.rank}`).join(',')
	);
	$effect(() => {
		const currentPlaysLen = plays.length;
		const currentSig = trickSig;
		const roundOver = isRoundComplete;
		if (currentPlaysLen > 0) {
			if (gatherTimer) clearTimeout(gatherTimer);
			if (flyTimer) clearTimeout(flyTimer);
			if (finishTimer) clearTimeout(finishTimer);
			gatherTimer = null;
			flyTimer = null;
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

			if (gatherTimer) clearTimeout(gatherTimer);
			if (flyTimer) clearTimeout(flyTimer);
			if (finishTimer) clearTimeout(finishTimer);

			// 1. Give 500ms for player to see the final card landing on table
			gatherTimer = setTimeout(() => {
				if (typeof document !== 'undefined' && containerEl && winnerId) {
					const cRect = containerEl.getBoundingClientRect();
					const centerX = cRect.left + cRect.width / 2;
					const centerY = cRect.top + cRect.height / 2;
					const isUserWinner = Boolean(myId && winnerId === myId);
					if (isUserWinner) {
						// User won: animate cards down to bottom-right of screen (personal trick pile next to footer tricks counter)
						const footerStats = document.querySelector('[data-tricks-counter]') ?? document.querySelector('footer div.flex');
						if (footerStats) {
							const fRect = footerStats.getBoundingClientRect();
							targetX = Math.round((fRect.left + fRect.width / 2) - centerX);
							targetY = Math.round((fRect.top + fRect.height / 2) - centerY);
						} else {
							targetX = Math.round((window.innerWidth - 80) - centerX);
							targetY = Math.round((window.innerHeight - 50) - centerY);
						}
					} else {
						// Bot/opponent won: animate cards up to their avatar badge in the seating row
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
				}
				animPhase = 'gathering';
			}, 500);

			// 2. Gather takes 700ms + 250ms hold in center with winner banner (total 950ms)
			flyTimer = setTimeout(() => {
				animPhase = 'flying';
			}, 500 + 700 + 250);

			// 3. Flying takes 750ms
			finishTimer = setTimeout(() => {
				animPhase = 'idle';
				animatedCardKeys.clear();
				gatherTimer = null;
				flyTimer = null;
				finishTimer = null;
				onCollectComplete?.();
			}, 500 + 700 + 250 + 750);
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
		}, 580);
		return {
			destroy() {
				clearTimeout(t);
			}
		};
	}

	const visible = $derived(
		plays.length > 0
			? plays
			: (animPhase === 'landing' || animPhase === 'gathering' || animPhase === 'flying' || isRoundComplete)
				? lastCompleteTrick
				: []
	);
</script>

<div
	bind:this={containerEl}
	class="relative w-full max-w-3xl mx-auto flex flex-col items-center justify-center flex-1 min-h-0 sm:tall:h-[220px] p-1 sm:tall:p-4 rounded-2xl sm:tall:rounded-[2.5rem] border-0 sm:tall:border-2 sm:tall:border-emerald-500/25 sm:tall:bg-[radial-gradient(ellipse_at_center,rgba(6,78,59,0.35)_0%,rgba(2,44,34,0.15)_50%,transparent_80%)] sm:tall:shadow-[inset_0_2px_28px_rgba(0,0,0,0.5),0_12px_36px_rgba(0,0,0,0.35)] overflow-visible"
	style:--target-x={`${targetX}px`}
	style:--target-y={`${targetY}px`}
>
	<div class="hidden sm:tall:block absolute inset-2.5 rounded-[2.2rem] border border-dashed border-emerald-500/20 pointer-events-none"></div>
	{#if (animPhase === 'gathering' || animPhase === 'flying') && winnerName}
		{@const isUserWinner = Boolean(myId && winnerId === myId)}
		<div class="absolute top-2.5 sm:top-3.5 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-in fade-in zoom-in-95 duration-200 whitespace-nowrap">
			<div class="px-4 py-1 rounded-full bg-emerald-950/95 border-2 border-emerald-400 text-emerald-200 font-black text-xs sm:text-sm shadow-xl shadow-emerald-950/60 backdrop-blur-md">
				<span>{isUserWinner ? 'You won the trick!' : `${winnerName} won the trick!`}</span>
			</div>
		</div>
	{/if}

	<div class="relative z-10 flex flex-col items-center justify-center w-full px-2 gap-1 sm:gap-2">
		{#each rows as row, rIdx (rIdx)}
			<div class="flex items-center justify-center gap-1.5 sm:gap-2.5">
				{#each row as item (item.slotIdx)}
					{@const slotIdx = item.slotIdx}
					{@const play = visible[slotIdx]}
					{@const coords = getGatherCoords(item)}
					<div
						class={cn(
							'trick-slot flex flex-col items-center shrink-0',
							useTwoRows
								? 'w-[44px] sm:tall:w-[64px] gap-0.5 sm:gap-1'
								: 'w-[52px] sm:tall:w-[80px] gap-1 sm:gap-1.5'
						)}
						class:is-gathering={animPhase === 'gathering'}
						class:is-flying={animPhase === 'flying'}
						style:z-index={play ? 10 + slotIdx : 0}
						style:--gather-x-mobile={`${coords.xMobile}px`}
						style:--gather-x-desktop={`${coords.xDesktop}px`}
						style:--gather-y-mobile={`${coords.yMobile}px`}
						style:--gather-y-desktop={`${coords.yDesktop}px`}
						style:--gather-rot={`${coords.rot}deg`}
					>
						{#if play}
							{@const cardKey = `${play.card.suit}-${play.card.rank}`}
							<div
								use:flyInFromBadge={{ playerId: play.playerId, cardKey }}
								class="w-full flex flex-col items-center gap-0.5 sm:gap-1 transition-all"
							>
								<div class="transform transition-transform hover:scale-105 duration-200 drop-shadow-xl rounded-lg">
									<PlayingCard card={play.card} {gameId} {handType} {trumpSuit} size={useTwoRows ? 'sm' : 'md'} />
								</div>
								<span
									class={cn(
										'trick-slot-meta font-bold text-foreground truncate text-center block w-full drop-shadow-sm px-0.5 leading-none',
										useTwoRows ? 'text-[8px] sm:text-[10px]' : 'text-[9px] sm:text-xs'
									)}
									title={playerNames[play.playerId] ?? '?'}
								>
									{getFirstName(playerNames[play.playerId] ?? '?')}
								</span>
							</div>
						{:else}
							<div
								class={cn(
									'trick-slot-empty w-full rounded-lg border-2 border-dashed border-emerald-500/20 bg-emerald-950/10 flex flex-col items-center justify-center text-emerald-400/40 shadow-inner select-none',
									useTwoRows
										? 'h-[64px] sm:tall:h-[92px]'
										: 'h-[76px] sm:tall:h-[116px]'
								)}
							>
								<span class={cn('opacity-40', useTwoRows ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-sm')}>♠</span>
								<span class={cn('uppercase font-bold tracking-wider opacity-40 mt-0.5', useTwoRows ? 'text-[7px] sm:text-[9px]' : 'text-[8px] sm:text-[10px]')}>
									{slotIdx === 0 ? 'Lead' : `${slotIdx + 1}`}
								</span>
							</div>
							<span class={cn('trick-slot-meta block opacity-0 select-none text-[8px]', useTwoRows ? 'h-2 sm:h-2.5' : 'h-3')}>...</span>
						{/if}
					</div>
				{/each}
			</div>
		{/each}
	</div>
</div>

<style>
	.trick-slot {
		--gather-x: var(--gather-x-desktop);
		--gather-y: var(--gather-y-desktop);
		will-change: transform, opacity;
	}
	@media (max-width: 639px), (max-height: 519px) {
		.trick-slot {
			--gather-x: var(--gather-x-mobile);
			--gather-y: var(--gather-y-mobile);
		}
	}
	.trick-slot.is-gathering {
		transform: translate(var(--gather-x), var(--gather-y)) rotate(var(--gather-rot)) scale(1);
		transition: transform 700ms cubic-bezier(0.25, 1, 0.5, 1);
		pointer-events: none;
	}
	.trick-slot.is-flying {
		transform: translate(calc(var(--gather-x) + var(--target-x)), calc(var(--gather-y) + var(--target-y))) rotate(calc(var(--gather-rot) + 12deg)) scale(0.2);
		opacity: 0;
		transition: transform 750ms cubic-bezier(0.22, 0.9, 0.32, 1), opacity 750ms ease-in;
		pointer-events: none;
	}
	.trick-slot.is-gathering :global(.trick-slot-meta),
	.trick-slot.is-flying :global(.trick-slot-meta),
	.trick-slot.is-gathering :global(.trick-slot-empty),
	.trick-slot.is-flying :global(.trick-slot-empty) {
		opacity: 0;
		pointer-events: none;
		transition: opacity 250ms ease-out;
	}
	:global(.fly-in-active) {
		animation: flyCardFromBadge 550ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
		will-change: transform, opacity;
	}

	@keyframes flyCardFromBadge {
		0% {
			transform: translate(var(--fly-from-x, 0px), var(--fly-from-y, -200px)) scale(0.35) rotate(-6deg);
			opacity: 0.15;
		}
		45% {
			opacity: 1;
		}
		100% {
			transform: translate(0, 0) scale(1) rotate(0deg);
			opacity: 1;
		}
	}
</style>
