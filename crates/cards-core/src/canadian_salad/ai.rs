use super::rules::HandType;
use crate::ai::{extreme, highest, lowest};
use crate::card::{Card, Seat, Suit, remove_card};
use crate::trick::{self, Play};
use crate::view::SeatView;

fn rollout_play(
    hand: &[Card],
    led: Option<Suit>,
    winner_rank: u8,
    hand_type: HandType,
    leader_winning: bool,
) -> Option<Card> {
    let penalty = |c: Card| hand_type.card_penalty(c);
    let Some(led) = led else {
        let safe: Vec<Card> = hand.iter().copied().filter(|c| penalty(*c) == 0).collect();
        return lowest(if safe.is_empty() { hand } else { &safe });
    };
    let on_suit: Vec<Card> = hand.iter().copied().filter(|c| c.suit == led).collect();
    if !on_suit.is_empty() {
        let ducks: Vec<Card> = on_suit
            .iter()
            .copied()
            .filter(|c| c.rank < winner_rank)
            .collect();
        return if ducks.is_empty() {
            lowest(&on_suit)
        } else {
            highest(&ducks)
        };
    }
    if !leader_winning {
        let penalties: Vec<Card> = hand.iter().copied().filter(|c| penalty(*c) > 0).collect();
        if !penalties.is_empty() {
            return extreme(&penalties, penalty, true);
        }
    }
    highest(hand)
}

struct Rollout {
    hands: Vec<Vec<Card>>,
    hand_type: HandType,
}

impl Rollout {
    fn play_next(
        &mut self,
        seat: usize,
        led: Option<Suit>,
        winner_rank: u8,
        leader_winning: bool,
    ) -> Option<Card> {
        let card = rollout_play(
            &self.hands[seat],
            led,
            winner_rank,
            self.hand_type,
            leader_winning,
        )?;
        remove_card(&mut self.hands[seat], card);
        Some(card)
    }

    fn remaining_tricks(&mut self, mut leader: usize, me: usize) -> i32 {
        let seats = self.hands.len();
        let cards_left = self.hands[me].len();
        let mut penalty = 0;
        for t in 0..cards_left {
            let mut plays: Vec<Play> = Vec::new();
            let (mut led, mut rank) = (None, 0u8);
            for i in 0..seats {
                let seat = (leader + i) % seats;
                let Some(card) = self.play_next(seat, led, rank, seat == leader) else {
                    return penalty;
                };
                if i == 0 {
                    led = Some(card.suit);
                    rank = card.rank;
                } else if Some(card.suit) == led && card.rank > rank {
                    rank = card.rank;
                }
                plays.push(Play {
                    seat: Seat::from_index(seat),
                    card,
                });
            }
            let Some(won) = trick::winner(&plays, None) else {
                return penalty;
            };
            leader = won.seat.index();
            if leader == me {
                penalty += self
                    .hand_type
                    .trick_penalty(plays.iter().map(|p| p.card), t == cards_left - 1);
            }
        }
        penalty
    }
}

/// Penalty the viewing seat collects for the rest of the hand after playing `candidate`.
pub fn rollout(view: &SeatView, hands: &[Vec<Card>], candidate: Card) -> i32 {
    let Some(hand_type) = view.hand_type else {
        return 0;
    };
    let me = view.seat.index();
    let seats = view.seats;
    let mut r = Rollout {
        hands: hands.to_vec(),
        hand_type,
    };
    remove_card(&mut r.hands[me], candidate);

    let mut plays = view.current_trick.clone();
    let led = plays.first().map_or(candidate.suit, |p| p.card.suit);
    let mut current = trick::winner(&plays, None);
    plays.push(Play {
        seat: view.seat,
        card: candidate,
    });
    if candidate.suit == led && current.is_none_or(|w| candidate.rank > w.card.rank) {
        current = plays.last().copied();
    }
    for step in 1..=(seats - plays.len()) {
        let seat = (me + step) % seats;
        let rank = current.map_or(0, |w| w.card.rank);
        let leader_winning = current.is_some_and(|w| w.seat.index() == seat);
        let Some(card) = r.play_next(seat, Some(led), rank, leader_winning) else {
            return 0;
        };
        let play = Play {
            seat: Seat::from_index(seat),
            card,
        };
        plays.push(play);
        if card.suit == led && card.rank > rank {
            current = Some(play);
        }
    }
    let Some(won) = trick::winner(&plays, None) else {
        return 0;
    };
    let is_last = r.hands[me].is_empty();
    let mut penalty = if won.seat == view.seat {
        hand_type.trick_penalty(plays.iter().map(|p| p.card), is_last)
    } else {
        0
    };
    if !is_last {
        penalty += r.remaining_tricks(won.seat.index(), me);
    }
    penalty
}
