<script lang="ts">
	import { Button } from '$lib/components/ui/button/index';

	interface Props {
		displayName: string;
		onSignOut?: () => void;
		onNameChange?: (name: string) => void;
		showAdmin?: boolean;
		onAdmin?: () => void;
	}

	let { displayName, onSignOut, onNameChange, showAdmin = false, onAdmin }: Props = $props();

	const MAX_NAME_LENGTH = 10;
	let editing = $state(false);
	let editValue = $state('');

	function startEdit() {
		editValue = displayName;
		editing = true;
	}

	function hasNameChanged(trimmed: string): boolean {
		return trimmed.length > 0 && trimmed !== displayName;
	}

	function confirmEdit() {
		const trimmed = editValue.trim().slice(0, MAX_NAME_LENGTH);
		if (hasNameChanged(trimmed)) onNameChange?.(trimmed);
		editing = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') confirmEdit();
		if (e.key === 'Escape') editing = false;
	}
</script>

<nav class="border-b border-border px-6 py-3 flex justify-between items-center">
	<h1 class="text-lg font-bold">Garden Salad</h1>
	<div class="flex items-center gap-4">
		{#if editing}
			<input
				class="bg-background border border-input rounded px-2 py-0.5 text-sm w-28"
				bind:value={editValue}
				maxlength={MAX_NAME_LENGTH}
				onkeydown={handleKeydown}
				onblur={confirmEdit}
			/>
		{:else}
			<button
				class="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
				onclick={startEdit}
				title="Click to edit name"
			>
				{displayName}
			</button>
		{/if}
		{#if showAdmin}
			<Button variant="ghost" size="sm" onclick={() => onAdmin?.()}>Users</Button>
		{/if}
		{#if onSignOut}
			<Button variant="ghost" size="sm" onclick={onSignOut}>Sign Out</Button>
		{/if}
	</div>
</nav>
