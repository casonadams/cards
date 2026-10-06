import { SvelteSet } from 'svelte/reactivity';
import {
	cardAttackValue,
	isValidCombo,
	comboAttackValue,
	comboSuits,
	isEnemyImmune
} from '$lib/games/regicide/index';
import type { Card } from '$lib/platform/types/index';
import type { RegicideUiState } from '$lib/games/regicide/ui-state';

export function cardKey(c: Card): string {
	return `${c.suit}-${c.rank}`;
}

export function createCardSelection() {
	return new SvelteSet<string>();
}

export function getSelected(myCards: readonly Card[], selectedCards: SvelteSet<string>): Card[] {
	return myCards.filter((c) => selectedCards.has(cardKey(c)));
}

export function isValidAttack(selected: readonly Card[]): boolean {
	return selected.length > 0 && isValidCombo(selected);
}

export function getAttackValue(valid: boolean, selected: readonly Card[]): number {
	return valid ? comboAttackValue(selected) : 0;
}

export function getDefenseValue(selected: readonly Card[]): number {
	return selected.reduce((s, c) => s + cardAttackValue(c), 0);
}

interface ClubsDoubleInput {
	readonly uiState: RegicideUiState;
	readonly selected: readonly Card[];
	readonly valid: boolean;
}

function hasClubsPower(
	selected: readonly Card[],
	enemy: NonNullable<RegicideUiState['currentEnemy']>
): boolean {
	return comboSuits(selected).includes('clubs') && !isEnemyImmune(enemy, 'clubs');
}

export function shouldShowClubsDouble(input: ClubsDoubleInput) {
	if (!input.valid || !input.uiState.currentEnemy) return false;
	return hasClubsPower(input.selected, input.uiState.currentEnemy);
}
