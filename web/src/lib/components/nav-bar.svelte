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

<nav class="border-b border-border/80 bg-card/75 backdrop-blur-md px-4 sm:px-6 py-2.5 flex justify-between items-center sticky top-0 z-40">
	<div class="flex items-center gap-2">
		<span class="text-base font-black tracking-tight flex items-center gap-1.5">
			<span class="text-emerald-400">♠</span>
			<span>Garden Salad</span>
		</span>
		<span class="hidden sm:inline-block text-[10px] text-muted-foreground/70 uppercase tracking-widest border border-border/70 rounded px-1.5 py-0.5">
			Cards
		</span>
	</div>
	<div class="flex items-center gap-3">
		{#if editing}
			<div class="flex items-center gap-1.5 bg-background border border-emerald-500/70 rounded-full px-2.5 py-1 shadow-sm">
				<input
					class="bg-transparent border-none outline-none text-xs w-24 sm:w-32 px-1 text-foreground font-semibold"
					bind:value={editValue}
					maxlength={MAX_NAME_LENGTH}
					onkeydown={handleKeydown}
					onblur={confirmEdit}
				/>
				<button
					class="text-emerald-400 hover:text-emerald-300 text-xs px-1 font-bold cursor-pointer"
					onclick={confirmEdit}
					title="Save name"
				>
					✓
				</button>
			</div>
		{:else}
			<button
				class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/60 border border-border/80 text-xs text-foreground hover:border-emerald-500/60 hover:bg-card transition-all cursor-pointer group shadow-xs"
				onclick={startEdit}
				title="Click to edit player name"
			>
				<div class="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-[11px] font-black">
					{displayName.slice(0, 1).toUpperCase()}
				</div>
				<span class="font-semibold truncate max-w-[100px] sm:max-w-[150px]">{displayName}</span>
				<span class="text-[10px] text-muted-foreground group-hover:text-emerald-400 opacity-70">✎</span>
			</button>
		{/if}
		{#if showAdmin}
			<Button variant="ghost" size="sm" class="text-xs h-8" onclick={() => onAdmin?.()}>Users</Button>
		{/if}
		{#if onSignOut}
			<Button variant="ghost" size="sm" class="text-xs h-8" onclick={onSignOut}>Sign Out</Button>
		{/if}
	</div>
</nav>
