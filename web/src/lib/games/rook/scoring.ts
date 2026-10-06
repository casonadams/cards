import type { RookCard } from './types.ts';

const POINT_VALUES: Record<string, number> = {
	bird: 20,
	'1': 15,
	'14': 10,
	'10': 10,
	'5': 5
};

function cardPoints(card: RookCard): number {
	const key = card.type === 'bird' ? 'bird' : String(card.value);
	return POINT_VALUES[key] ?? 0;
}

export function sumPoints(cards: readonly RookCard[]): number {
	return cards.reduce((sum, c) => sum + cardPoints(c), 0);
}

export interface TeamScore {
	readonly team1Points: number;
	readonly team2Points: number;
}

export interface RoundScoreResult {
	readonly team1Delta: number;
	readonly team2Delta: number;
}

export interface RoundScoreParams {
	readonly captured: TeamScore;
	readonly highBid: number;
	readonly biddingTeam: 1 | 2;
}

function getBidderDelta(bidderPoints: number, highBid: number): number {
	return bidderPoints >= highBid ? bidderPoints : -highBid;
}

function splitByTeam(
	captured: TeamScore,
	biddingTeam: 1 | 2
): { bidderPoints: number; defenderPoints: number } {
	if (biddingTeam === 1)
		return { bidderPoints: captured.team1Points, defenderPoints: captured.team2Points };
	return { bidderPoints: captured.team2Points, defenderPoints: captured.team1Points };
}

interface AssembleInput {
	readonly bidderDelta: number;
	readonly defenderPoints: number;
	readonly biddingTeam: 1 | 2;
}

function assembleResult(input: AssembleInput): RoundScoreResult {
	if (input.biddingTeam === 1)
		return { team1Delta: input.bidderDelta, team2Delta: input.defenderPoints };
	return { team1Delta: input.defenderPoints, team2Delta: input.bidderDelta };
}

export function computeRoundScore(params: RoundScoreParams): RoundScoreResult {
	const { bidderPoints, defenderPoints } = splitByTeam(params.captured, params.biddingTeam);
	const bidderDelta = getBidderDelta(bidderPoints, params.highBid);
	return assembleResult({ bidderDelta, defenderPoints, biddingTeam: params.biddingTeam });
}
