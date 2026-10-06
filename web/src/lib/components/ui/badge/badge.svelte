<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
		class?: string;
		children: Snippet;
	}

	let { variant = 'default', class: className, children }: Props = $props();

	const variants: Record<string, string> = {
		default: 'bg-primary text-primary-foreground',
		secondary: 'bg-secondary text-secondary-foreground',
		destructive: 'bg-destructive text-destructive-foreground',
		outline: 'text-foreground border',
		success: 'bg-success text-success-foreground',
		warning: 'bg-warning text-warning-foreground'
	};
</script>

<div
	class={cn(
		'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
		variants[variant],
		className
	)}
>
	{@render children()}
</div>
