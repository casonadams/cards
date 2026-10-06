<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index';

	interface Props {
		handType: string;
	}

	let { handType }: Props = $props();
</script>

<div
	class="bg-card/60 backdrop-blur-sm border-b border-border/80 px-4 py-2 flex flex-wrap gap-2 items-center text-xs justify-center sm:justify-start"
>
	<span class="text-muted-foreground font-semibold">Active Penalties:</span>
	{#if handType === 'NO_TRICKS'}
		<Badge variant="destructive" class="gap-1.5 py-0.5 bg-rose-500/20 text-rose-300 border-rose-500/40">
			<span>Tricks</span>
			<span class="opacity-80">+10 pts each</span>
		</Badge>
	{:else if handType === 'NO_HEARTS'}
		<Badge variant="destructive" class="gap-1.5 py-0.5 bg-rose-500/20 text-rose-300 border-rose-500/40">
			<span class="text-rose-400 font-bold">♥</span>
			<span>Hearts</span>
			<span class="opacity-80">+10 pts each</span>
		</Badge>
	{:else if handType === 'NO_QUEENS'}
		<Badge
			variant="destructive"
			class="gap-1.5 py-0.5 bg-purple-500/20 text-purple-300 border-purple-500/40"
		>
			<span>♛ Queens</span>
			<span class="opacity-80">+25 pts each</span>
		</Badge>
	{:else if handType === 'NO_KING_SPADES'}
		<Badge
			variant="destructive"
			class="gap-1.5 py-0.5 bg-slate-500/20 text-slate-200 border-slate-400/40"
		>
			<span>♠ K of Spades</span>
			<span class="opacity-80">+100 pts</span>
		</Badge>
	{:else if handType === 'NO_LAST_TRICK'}
		<Badge variant="destructive" class="gap-1.5 py-0.5 bg-amber-500/20 text-amber-300 border-amber-500/40">
			<span>Last Trick</span>
			<span class="opacity-80">+100 pts</span>
		</Badge>
	{:else if handType === 'COMBINATION'}
		<div class="flex flex-wrap gap-1.5">
			<Badge variant="destructive" class="gap-1 py-0.5 text-[11px] bg-rose-500/15 text-rose-300 border-rose-500/30">
				<span>Tricks (+10)</span>
			</Badge>
			<Badge
				variant="destructive"
				class="gap-1 py-0.5 bg-rose-500/20 text-rose-300 border-rose-500/40 text-[11px]"
			>
				<span>♥ Hearts (+10)</span>
			</Badge>
			<Badge
				variant="destructive"
				class="gap-1 py-0.5 bg-purple-500/20 text-purple-300 border-purple-500/40 text-[11px]"
			>
				<span>♛ Queens (+25)</span>
			</Badge>
			<Badge
				variant="destructive"
				class="gap-1 py-0.5 bg-slate-500/20 text-slate-200 border-slate-400/40 text-[11px]"
			>
				<span>♠ K (+100)</span>
			</Badge>
			<Badge variant="destructive" class="gap-1 py-0.5 text-[11px] bg-amber-500/20 text-amber-300 border-amber-500/40">
				<span>Last Trick (+100)</span>
			</Badge>
		</div>
	{/if}
</div>
