export interface TurnState {
	readonly playerCount: number;
	readonly currentIndex: number;
}

export function createTurnState(playerCount: number, startIndex: number): TurnState {
	return { playerCount, currentIndex: startIndex };
}

export function nextTurn(state: TurnState): TurnState {
	return {
		...state,
		currentIndex: (state.currentIndex + 1) % state.playerCount
	};
}

export function setLeader(state: TurnState, leaderIndex: number): TurnState {
	return { ...state, currentIndex: leaderIndex };
}

export function advanceFromLeader(state: TurnState, steps: number): TurnState {
	return {
		...state,
		currentIndex: (state.currentIndex + steps) % state.playerCount
	};
}
