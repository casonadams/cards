import { MIN_BID, BID_INCREMENT, MAX_BID, type BidState, type BidAction } from './types.ts';

const PASS_THRESHOLD = 3;

export function createInitialBidState(startingBidder: number): BidState {
	return {
		currentBidder: startingBidder,
		highBid: 0,
		highBidder: -1,
		passCount: 0,
		bids: []
	};
}

export function isBiddingComplete(state: BidState): boolean {
	return state.passCount >= PASS_THRESHOLD && state.highBidder >= 0;
}

function isWithinRange(amount: number): boolean {
	return amount >= MIN_BID && amount <= MAX_BID;
}

export function isValidBid(state: BidState, amount: number): boolean {
	if (!isWithinRange(amount)) return false;
	if (amount % BID_INCREMENT !== 0) return false;
	return amount > state.highBid;
}

export interface BidActionParams {
	readonly state: BidState;
	readonly playerId: string;
	readonly action: BidAction;
	readonly amount: number | undefined;
	readonly playerCount: number;
}

function applyPass(params: BidActionParams): BidState {
	return {
		...params.state,
		passCount: params.state.passCount + 1,
		currentBidder: (params.state.currentBidder + 1) % params.playerCount,
		bids: [...params.state.bids, { playerId: params.playerId, action: params.action }]
	};
}

function applyRaise(params: BidActionParams): BidState {
	return {
		...params.state,
		highBid: params.amount!,
		highBidder: params.state.currentBidder,
		passCount: 0,
		currentBidder: (params.state.currentBidder + 1) % params.playerCount,
		bids: [
			...params.state.bids,
			{ playerId: params.playerId, action: params.action, amount: params.amount }
		]
	};
}

export function applyBidAction(params: BidActionParams): BidState {
	if (params.action === 'pass') return applyPass(params);
	return applyRaise(params);
}
