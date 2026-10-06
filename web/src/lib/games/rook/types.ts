export type RookColor = 'black' | 'red' | 'green' | 'yellow';

export const ROOK_COLORS: readonly RookColor[] = ['black', 'red', 'green', 'yellow'];

export interface NumberCard {
	readonly type: 'number';
	readonly color: RookColor;
	readonly value: number;
}

export interface BirdCard {
	readonly type: 'bird';
}

export type RookCard = NumberCard | BirdCard;

export type BidAction = 'bid' | 'pass';

export interface Partnership {
	readonly team1: readonly [string, string];
	readonly team2: readonly [string, string];
}

export type RookPhase = 'bidding' | 'nestExchange' | 'trumpSelection' | 'playing' | 'scoring';

export interface BidState {
	readonly currentBidder: number;
	readonly highBid: number;
	readonly highBidder: number;
	readonly passCount: number;
	readonly bids: readonly { playerId: string; action: BidAction; amount?: number }[];
}

export interface RookRoundState {
	readonly phase: RookPhase;
	readonly trumpColor: RookColor | null;
	readonly bidState: BidState;
	readonly nest: readonly RookCard[];
	readonly partnerships: Partnership;
	readonly team1Total: number;
	readonly team2Total: number;
	readonly discardedNest: readonly RookCard[];
}

export const MIN_BID = 70;
export const BID_INCREMENT = 5;
export const MAX_BID = 180;
export const WINNING_SCORE = 300;
export const CARDS_PER_PLAYER = 10;
export const NEST_SIZE = 5;
export const PLAYER_COUNT = 4;
