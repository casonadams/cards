import { registerGame } from '$lib/platform/engine/game-registry';
import { canadianSaladRuntime } from './canadian-salad/runtime.ts';
import { ohWellRuntime } from './oh-well/runtime.ts';

export function registerAllGames(): void {
	registerGame(canadianSaladRuntime);
	registerGame(ohWellRuntime);
}
