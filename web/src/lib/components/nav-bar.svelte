<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index';

	interface Props {
		displayName: string;
		networkStatus?: string;
		onNameChange?: (name: string) => void;
	}

	let { displayName, networkStatus = 'P2P Ready', onNameChange }: Props = $props();

	const MAX_NAME_LENGTH = 12;
	let editing = $state(false);
	let editValue = $state('');

	function startEdit() {
		editValue = displayName;
		editing = true;
	}

	function confirmEdit() {
		const trimmed = editValue.trim().slice(0, MAX_NAME_LENGTH);
		if (trimmed.length > 0 && trimmed !== displayName) {
			onNameChange?.(trimmed);
		}
		editing = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') confirmEdit();
		if (e.key === 'Escape') editing = false;
	}
</script>

<nav class="border-b border-border px-6 py-3 flex justify-between items-center">
	<div class="flex items-center gap-3">
		<h1 class="text-lg font-bold tracking-tight">Cards</h1>
		<Badge variant="outline" class="text-[11px] font-mono opacity-80">
			{networkStatus}
		</Badge>
	</div>
	<div class="flex items-center gap-4">
		{#if editing}
			<input
				class="bg-background border border-input rounded px-2 py-0.5 text-sm w-32 focus:outline-none focus:ring-1 focus:ring-primary"
				bind:value={editValue}
				maxlength={MAX_NAME_LENGTH}
				onkeydown={handleKeydown}
				onblur={confirmEdit}
			/>
		{:else}
			<button
				class="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1.5"
				onclick={startEdit}
				title="Click to edit player name"
			>
				<span>👤 {displayName}</span>
				<span class="text-[10px] text-muted-foreground/60">(edit)</span>
			</button>
		{/if}
	</div>
</nav>
