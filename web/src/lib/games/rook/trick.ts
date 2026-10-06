import type { RookCard, RookColor } from './types.ts';

export interface RookTrickPlay {
	readonly playerId: string;
	readonly card: RookCard;
}

interface CardContext {
	readonly card: RookCard;
	readonly ledColor: RookColor;
	readonly trump: RookColor;
}

const BIRD_STRENGTH = 1000;
const TRUMP_BASE = 100;
const OFF_SUIT = -1;

function getSuitBonus(color: RookColor, trump: RookColor): number {
	if (color === trump) return TRUMP_BASE;
	return 0;
}

function cardRank(value: number): number {
	return value === 1 ? 15 : value;
}

function numberCardStrength(ctx: CardContext): number {
	const c = ctx.card as { color: RookColor; value: number };
	if (c.color !== ctx.trump && c.color !== ctx.ledColor) return OFF_SUIT;
	return getSuitBonus(c.color, ctx.trump) + cardRank(c.value);
}

function cardStrength(ctx: CardContext): number {
	if (ctx.card.type === 'bird') return BIRD_STRENGTH;
	return numberCardStrength(ctx);
}

function ledColorFromPlay(card: RookCard, trump: RookColor): RookColor {
	return card.type === 'bird' ? trump : card.color;
}

interface TrickContext {
	readonly ledColor: RookColor;
	readonly trump: RookColor;
}

function findStrongest(plays: readonly RookTrickPlay[], ctx: TrickContext): RookTrickPlay {
	const { ledColor, trump } = ctx;
	let best = plays[0];
	let bestStrength = cardStrength({ card: best.card, ledColor, trump });
	for (let i = 1; i < plays.length; i++) {
		const s = cardStrength({ card: plays[i].card, ledColor, trump });
		if (s <= bestStrength) continue;
		best = plays[i];
		bestStrength = s;
	}
	return best;
}

export function resolveRookTrick(
	plays: readonly RookTrickPlay[],
	trump: RookColor
): { winnerId: string; winningCard: RookCard } {
	const ledColor = ledColorFromPlay(plays[0].card, trump);
	const best = findStrongest(plays, { ledColor, trump });
	return { winnerId: best.playerId, winningCard: best.card };
}

export function getCardColor(card: RookCard, trump: RookColor): RookColor {
	return card.type === 'bird' ? trump : card.color;
}

export function canFollowSuit(hand: readonly RookCard[], ledColor: RookColor): boolean {
	return hand.some((c) => c.type === 'number' && c.color === ledColor);
}

export interface ValidPlayParams {
	readonly card: RookCard;
	readonly hand: readonly RookCard[];
	readonly ledColor: RookColor | null;
}

function isExemptFromFollowing(params: ValidPlayParams): boolean {
	if (!params.ledColor) return true;
	return params.card.type === 'bird' || params.card.color === params.ledColor;
}

export function isValidPlay(params: ValidPlayParams): boolean {
	if (isExemptFromFollowing(params)) return true;
	return !canFollowSuit(params.hand, params.ledColor!);
}
