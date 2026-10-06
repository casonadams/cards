export { rookRuntime } from './runtime.ts';
export { createRookDeck, cardId, isSameCard } from './deck.ts';
export { dealRook } from './deal.ts';
export { sumPoints, computeRoundScore } from './scoring.ts';
export { resolveRookTrick, isValidPlay, canFollowSuit } from './trick.ts';
export { rookToCard, cardToRook } from './card-adapter.ts';

export type { RookCard, RookColor, NumberCard, BirdCard, RookRoundState } from './types.ts';
