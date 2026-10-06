<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';

	let { class: className, children }: { class?: string; children: Snippet } = $props();
</script>

<div class={cn('p-6 pt-0 flex flex-col', className)}>
	{@render children()}
</div>
