import { HAND_SIZES } from './types.ts';
import type { Card } from '$lib/platform/types/index';
import type { GameState } from './engine.ts';

interface DrawContext {
	readonly hands: Card[][];
	readonly tavern: Card[];
	readonly maxSize: number;
	readonly playerCount: number;
	readonly startPlayer: number;
	readonly attackValue: number;
}

function drawOneCard(ctx: DrawContext, playerIdx: number): boolean {
	const hand = ctx.hands[playerIdx];
	if (!hand || hand.length >= ctx.maxSize) return false;
	hand.push(ctx.tavern.shift()!);
	return true;
}

function isComplete(progress: DrawProgress, ctx: DrawContext): boolean {
	return progress.drawn >= ctx.attackValue || ctx.tavern.length === 0;
}

interface DrawProgress {
	drawn: number;
	playerIdx: number;
}

function hasWrapped(progress: DrawProgress, ctx: DrawContext): boolean {
	return progress.drawn > 0 && progress.playerIdx === ctx.startPlayer;
}

function shouldContinue(progress: DrawProgress, ctx: DrawContext): boolean {
	return !isComplete(progress, ctx) && !hasWrapped(progress, ctx);
}

function drawRound(ctx: DrawContext, progress: DrawProgress): void {
	if (drawOneCard(ctx, progress.playerIdx)) progress.drawn++;
	progress.playerIdx = (progress.playerIdx + 1) % ctx.playerCount;
}

function distributeCards(ctx: DrawContext): number {
	const progress: DrawProgress = { drawn: 0, playerIdx: ctx.startPlayer };
	while (shouldContinue(progress, ctx)) drawRound(ctx, progress);
	return progress.drawn;
}

function buildDrawContext(state: GameState, attackValue: number): DrawContext {
	return {
		hands: state.hands.map((h) => [...h]),
		tavern: [...state.tavern],
		maxSize: HAND_SIZES[state.playerCount] ?? 5,
		playerCount: state.playerCount,
		startPlayer: state.currentPlayer,
		attackValue
	};
}

export function drawDiamondCards(
	state: GameState,
	attackValue: number
): { state: GameState; drawn: number } {
	const ctx = buildDrawContext(state, attackValue);
	const drawn = distributeCards(ctx);
	return { state: { ...state, hands: ctx.hands, tavern: ctx.tavern }, drawn };
}
