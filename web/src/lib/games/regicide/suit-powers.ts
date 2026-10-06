import { comboSuits, isEnemyImmune, type Enemy } from './types.ts';
import { shuffle } from '$lib/platform/engine/index';
import { drawDiamondCards } from './diamond-draw.ts';
import type { Card } from '$lib/platform/types/index';
import type { GameState } from './engine.ts';

export interface SuitPowerResult {
	readonly enemy: Enemy;
	readonly state: GameState;
	readonly powers: readonly string[];
}

export interface SuitPowerParams {
	readonly state: GameState;
	readonly enemy: Enemy;
	readonly cards: readonly Card[];
	readonly attackValue: number;
}

interface SuitResult {
	enemy: Enemy;
	state: GameState;
	power: string;
}

interface SingleSuitParams {
	readonly suit: string;
	readonly enemy: Enemy;
	readonly state: GameState;
	readonly attackValue: number;
}

function applySpades(p: SingleSuitParams): SuitResult {
	const newEnemy = { ...p.enemy, attackReduction: p.enemy.attackReduction + p.attackValue };
	return { enemy: newEnemy, state: p.state, power: `spades: -${p.attackValue} attack` };
}

function applyHearts(p: SingleSuitParams): SuitResult {
	const recycled = Math.min(p.attackValue, p.state.discard.length);
	if (recycled === 0) return { enemy: p.enemy, state: p.state, power: 'hearts: recycled 0' };
	const shuffled = shuffle([...p.state.discard], Date.now());
	const newState = {
		...p.state,
		tavern: [...p.state.tavern, ...shuffled.slice(0, recycled)],
		discard: shuffled.slice(recycled)
	};
	return { enemy: p.enemy, state: newState, power: `hearts: recycled ${recycled}` };
}

function applyDiamonds(p: SingleSuitParams): SuitResult {
	const r = drawDiamondCards(p.state, p.attackValue);
	return { enemy: p.enemy, state: r.state, power: `diamonds: drew ${r.drawn}` };
}

function applyClubs(p: SingleSuitParams): SuitResult {
	return { enemy: p.enemy, state: p.state, power: `${p.suit}: clubs boost` };
}

type SuitHandler = (p: SingleSuitParams) => SuitResult;

const SUIT_HANDLERS: Record<string, SuitHandler> = {
	spades: applySpades,
	hearts: applyHearts,
	diamonds: applyDiamonds
};

function applySingleSuit(p: SingleSuitParams): SuitResult {
	const handler = SUIT_HANDLERS[p.suit] ?? applyClubs;
	return handler(p);
}

export function applySuitPowers(params: SuitPowerParams): SuitPowerResult {
	const suits = comboSuits(params.cards);
	let enemy = params.enemy;
	let state = params.state;
	const powers: string[] = [];
	for (const suit of suits) {
		if (isEnemyImmune(enemy, suit)) {
			powers.push(`${suit}: immune`);
			continue;
		}
		const r = applySingleSuit({ suit, enemy, state, attackValue: params.attackValue });
		enemy = r.enemy;
		state = r.state;
		powers.push(r.power);
	}
	return { enemy, state, powers };
}
