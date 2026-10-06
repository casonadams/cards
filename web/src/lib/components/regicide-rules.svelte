<script lang="ts">
	const suitColors: Record<string, string> = {
		hearts: 'text-red-300',
		diamonds: 'text-amber-300',
		clubs: 'text-sky-300',
		spades: 'text-slate-300'
	};
</script>

<div
	class="bg-muted/50 border-b border-border px-4 py-3 text-xs text-muted-foreground flex flex-col gap-2.5 max-h-64 overflow-y-auto"
>
	<p class="font-semibold text-foreground">How to Play Regicide</p>
	<p>
		Work together to defeat 12 enemies: Jacks (HP 20, ATK 10), Queens (HP 30, ATK 15), and Kings (HP
		40, ATK 20).
	</p>
	<p class="font-semibold text-foreground">On Your Turn</p>
	<ul class="list-disc list-inside flex flex-col gap-1.5">
		<li>
			<strong>Play cards</strong> to attack the current enemy. Play a single card or a combo of cards
			with the same rank (e.g., two 5s).
		</li>
		<li>
			<strong>Yield</strong> if you cannot or choose not to attack. You discard one card and draw one.
		</li>
	</ul>
	<p class="font-semibold text-foreground">Suit Powers</p>
	<ul class="list-disc list-inside flex flex-col gap-1.5">
		<li><span class={suitColors.clubs}>Clubs</span> -- Double Damage</li>
		<li><span class={suitColors.spades}>Spades</span> -- Reduce enemy attack</li>
		<li><span class={suitColors.hearts}>Hearts</span> -- Recycle cards from discard to tavern</li>
		<li><span class={suitColors.diamonds}>Diamonds</span> -- Draw cards from tavern</li>
	</ul>
	<p class="font-semibold text-foreground">Immunity</p>
	<p>Each enemy is immune to their own suit's power. Combos with all four suits break immunity.</p>
	<p class="font-semibold text-foreground">Defense</p>
	<p>
		After attacking, if the enemy survives, it strikes back. You must discard cards whose total
		value meets or exceeds the enemy's attack (reduced by spades).
	</p>
	<p class="font-semibold text-foreground">Defeating Enemies</p>
	<p>
		If your attack equals the enemy's remaining HP exactly, the enemy goes to the tavern (draw pile)
		instead of the discard. Defeat all 12 to win!
	</p>
</div>
