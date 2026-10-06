import { setup, assign } from 'xstate';
import type { GameMachineContext, GameMachineEvent } from './game-machine-types.ts';

export type { GameMachineContext, GameMachineEvent };

export const gameMachine = setup({
	types: {
		context: {} as GameMachineContext,
		events: {} as GameMachineEvent
	}
}).createMachine({
	id: 'game',
	initial: 'lobby',
	context: {
		players: [],
		currentRound: 0,
		totalRounds: 6,
		scores: [],
		gameState: null,
		disconnectedPlayerId: null
	},
	states: {
		lobby: {
			on: {
				START_GAME: {
					target: 'setup',
					actions: assign({
						totalRounds: ({ event }) => event.totalRounds,
						currentRound: () => 0,
						scores: () => []
					})
				}
			}
		},
		setup: {
			on: {
				SETUP_COMPLETE: {
					target: 'playing',
					actions: assign({
						gameState: ({ event }) => event.gameState,
						currentRound: ({ context }) => context.currentRound + 1
					})
				}
			}
		},
		playing: {
			on: {
				ROUND_COMPLETE: [
					{
						guard: ({ event }) => event.isGameOver,
						target: 'gameOver',
						actions: assign({
							scores: ({ context, event }) => [...context.scores, ...event.scores]
						})
					},
					{
						target: 'roundScoring',
						actions: assign({
							scores: ({ context, event }) => [...context.scores, ...event.scores]
						})
					}
				],
				PLAYER_DISCONNECTED: {
					target: 'paused',
					actions: assign({
						disconnectedPlayerId: ({ event }) => event.playerId
					})
				}
			}
		},
		paused: {
			on: {
				PLAYER_RECONNECTED: {
					target: 'playing',
					actions: assign({ disconnectedPlayerId: () => null })
				},
				TIMEOUT: { target: 'gameOver' }
			}
		},
		roundScoring: {
			on: { NEXT_ROUND: { target: 'setup' } }
		},
		gameOver: {
			on: {
				RETURN_TO_LOBBY: {
					target: 'lobby',
					actions: assign({
						currentRound: () => 0,
						scores: () => [],
						gameState: () => null,
						disconnectedPlayerId: () => null
					})
				}
			}
		}
	}
});
