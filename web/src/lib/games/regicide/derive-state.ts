import { setupRegicide } from './setup.ts';
import { initGameState, type GameState } from './engine.ts';
import { parseGameState } from './parse-state.ts';
import type { DeriveParams, DerivedState } from '$lib/platform/types/game-runtime';
import type { ScoreEntry } from '$lib/platform/types/index';
import type { RegicideUiState } from './ui-state.ts';

function getState(params: DeriveParams): GameState {
	const parsed = parseGameState(params.gameSpecific, params.playerCount);
	if (parsed) return parsed;
	const setup = setupRegicide(params.playerCount, params.seed);
	return initGameState({ castle: setup.castle, hands: setup.hands, tavern: setup.tavern });
}

function effectiveAttack(state: GameState): number {
	if (!state.currentEnemy) return 0;
	return Math.max(0, state.currentEnemy.baseAttack - state.currentEnemy.attackReduction);
}

function safeLen(arr: readonly unknown[] | undefined): number {
	return arr ? arr.length : 0;
}

function buildUiState(
	state: GameState,
	turnFlags: { isPlaying: boolean; isDefending: boolean }
): RegicideUiState {
	return {
		phase: state.phase,
		currentEnemy: state.currentEnemy,
		castleRemaining: safeLen(state.castle),
		tavernSize: safeLen(state.tavern),
		discardSize: safeLen(state.discard),
		defenseNeeded: state.defenseNeeded,
		isDefending: turnFlags.isDefending,
		canPlay: turnFlags.isPlaying,
		canYield: turnFlags.isPlaying,
		lastPlayedCards: state.lastPlayedCards,
		lastSuitPowers: state.lastSuitPowers,
		enemyEffectiveAttack: effectiveAttack(state)
	};
}

function buildHandType(state: GameState): string {
	if (!state.currentEnemy) {
		return state.phase === 'victory' ? 'Victory' : 'Defeat';
	}
	return `${state.currentEnemy.currentHealth}/${state.currentEnemy.maxHealth} HP`;
}

function isGameOver(state: GameState): boolean {
	return state.phase === 'victory' || state.phase === 'defeat';
}

function buildRoundScores(state: GameState, playerIds: readonly string[]): ScoreEntry[] | null {
	if (!isGameOver(state)) return null;
	const points = state.phase === 'victory' ? 1 : 0;
	return playerIds.map((id) => ({ playerId: id, points }));
}

function buildPlayerStats(state: GameState, playerIds: readonly string[]) {
	return playerIds.map((id, i) => ({
		playerId: id,
		tricksTaken: state.hands[i]?.length ?? 0,
		currentScore: 0
	}));
}

interface TurnFlags {
	readonly isPlaying: boolean;
	readonly isDefending: boolean;
}

function computeTurnFlags(state: GameState, myIndex: number): TurnFlags {
	return {
		isPlaying: state.phase === 'play' && state.currentPlayer === myIndex,
		isDefending: state.phase === 'defend' && state.defendingPlayer === myIndex
	};
}

function currentTurnIndex(state: GameState): number {
	return state.phase === 'defend' ? state.defendingPlayer : state.currentPlayer;
}

function getMyHand(state: GameState, myIndex: number): readonly Card[] {
	return state.hands[myIndex] ?? [];
}

import type { Card } from '$lib/platform/types/index';

function buildPlayableCards(flags: TurnFlags, myHand: readonly Card[]): readonly Card[] {
	const isMyTurn = flags.isPlaying || flags.isDefending;
	return isMyTurn ? myHand : [];
}

export function deriveRegicideState(params: DeriveParams): DerivedState {
	const state = getState(params);
	const myIndex = params.playerIds.indexOf(params.myId);
	const flags = computeTurnFlags(state, myIndex);
	const myHand = getMyHand(state, myIndex);
	return {
		handType: buildHandType(state),
		myRemainingHand: myHand,
		trickPlays: [],
		lastCompleteTrick: [],
		lastTrickWinnerId: null,
		currentTurnIndex: currentTurnIndex(state),
		isMyTurn: flags.isPlaying || flags.isDefending,
		playableCards: buildPlayableCards(flags, myHand),
		isRoundComplete: isGameOver(state),
		allPlayerStats: buildPlayerStats(state, params.playerIds),
		roundScores: buildRoundScores(state, params.playerIds),
		isGameOver: isGameOver(state),
		gameSpecific: buildUiState(state, flags)
	};
}
