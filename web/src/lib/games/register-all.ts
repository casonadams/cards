import { registerGame } from '$lib/platform/engine/game-registry';
import { canadianSaladRuntime } from './canadian-salad/runtime.ts';
import { ohWellRuntime } from './oh-well/runtime.ts';
import { heartsRuntime } from './hearts/runtime.ts';
import { spadesRuntime } from './spades/runtime.ts';
import { euchreRuntime } from './euchre/runtime.ts';
import { wizardRuntime } from './wizard/runtime.ts';
import { cribbageRuntime } from './cribbage/runtime.ts';
import { ginRummyRuntime } from './gin-rummy/runtime.ts';

export function registerAllGames(): void {
	registerGame(canadianSaladRuntime);
	registerGame(ohWellRuntime);
	registerGame(heartsRuntime);
	registerGame(spadesRuntime);
	registerGame(euchreRuntime);
	registerGame(wizardRuntime);
	registerGame(cribbageRuntime);
	registerGame(ginRummyRuntime);
}

