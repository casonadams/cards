<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index';

	interface Props {
		handType: string;
	}

	let { handType }: Props = $props();
</script>

<div
	class="bg-muted/30 border-b border-border px-4 py-1.5 flex flex-wrap gap-2 items-center text-xs justify-center sm:justify-start"
>
	<span class="text-muted-foreground font-medium">Active Penalties:</span>
	{#if handType === 'NO_TRICKS'}
		<Badge variant="destructive" class="gap-1.5 py-0.5">
			<span>Tricks</span>
			<span class="opacity-80">+10 pts each</span>
		</Badge>
	{:else if handType === 'NO_HEARTS'}
		<Badge variant="destructive" class="gap-1.5 py-0.5 bg-red-950/60 text-red-200 border-red-900">
			<span class="text-red-500 font-bold">♥</span>
			<span>Hearts</span>
			<span class="opacity-80">+10 pts each</span>
		</Badge>
	{:else if handType === 'NO_QUEENS'}
		<Badge
			variant="destructive"
			class="gap-1.5 py-0.5 bg-amber-950/60 text-amber-200 border-amber-900"
		>
			<span>♛ Queens</span>
			<span class="opacity-80">+25 pts each</span>
		</Badge>
	{:else if handType === 'NO_KING_SPADES'}
		<Badge
			variant="destructive"
			class="gap-1.5 py-0.5 bg-slate-950/60 text-slate-200 border-slate-900"
		>
			<span>♠ K of Spades</span>
			<span class="opacity-80">+100 pts</span>
		</Badge>
	{:else if handType === 'NO_LAST_TRICK'}
		<Badge variant="destructive" class="gap-1.5 py-0.5">
			<span>Last Trick</span>
			<span class="opacity-80">+100 pts</span>
		</Badge>
	{:else if handType === 'COMBINATION'}
		<div class="flex flex-wrap gap-1">
			<Badge variant="destructive" class="gap-1 py-0.5 text-[10px]">
				<span>Tricks (+10)</span>
			</Badge>
			<Badge
				variant="destructive"
				class="gap-1 py-0.5 bg-red-950/60 text-red-200 border-red-900 text-[10px]"
			>
				<span>♥ Hearts (+10)</span>
			</Badge>
			<Badge
				variant="destructive"
				class="gap-1 py-0.5 bg-amber-950/60 text-amber-200 border-amber-900 text-[10px]"
			>
				<span>♛ Queens (+25)</span>
			</Badge>
			<Badge
				variant="destructive"
				class="gap-1 py-0.5 bg-slate-950/60 text-slate-200 border-slate-900 text-[10px]"
			>
				<span>♠ K (+100)</span>
			</Badge>
			<Badge variant="destructive" class="gap-1 py-0.5 text-[10px]">
				<span>Last Trick (+100)</span>
			</Badge>
		</div>
	{/if}
</div>
