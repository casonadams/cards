//! Where each player stands this hand, in words and numbers the seat chips and hand header show.

use cards_core::canadian_salad::rules::HandType;
use cards_core::{GameKind, Phase, Seat, SeatView, Trick};

/// An Oh Well player's position against their bid.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Pace {
    NoBid,
    /// Still needs this many tricks, and enough remain to get them.
    Need(usize),
    /// Exactly on the bid; winning another breaks it.
    Made,
    Over(usize),
    /// Needs more tricks than remain.
    Missed,
}

pub fn pace(bid: Option<u8>, won: usize, tricks_left: usize) -> Pace {
    let Some(bid) = bid.map(usize::from) else {
        return Pace::NoBid;
    };
    match won.cmp(&bid) {
        std::cmp::Ordering::Equal => Pace::Made,
        std::cmp::Ordering::Greater => Pace::Over(won - bid),
        std::cmp::Ordering::Less if bid - won > tricks_left => Pace::Missed,
        std::cmp::Ordering::Less => Pace::Need(bid - won),
    }
}

/// Canadian Salad penalty points each seat has taken so far this hand.
pub fn salad_points(
    hand: HandType,
    tricks: &[Trick],
    seats: usize,
    tricks_in_hand: usize,
) -> Vec<i32> {
    let mut points = vec![0; seats];
    for (i, trick) in tricks.iter().enumerate() {
        let cards = trick.plays.iter().map(|p| p.card);
        if let Some(p) = points.get_mut(trick.winner.index()) {
            *p += hand.trick_penalty(cards, i + 1 == tricks_in_hand);
        }
    }
    points
}

/// How a seat chip colours its headline number.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Tone {
    Neutral,
    Good,
    Warn,
    Bad,
}

/// A seat chip's stats: a headline (bid progress or penalty this hand) and the running total.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SeatStats {
    pub headline: String,
    pub tone: Tone,
    pub total: String,
}

pub fn seat_stats(view: &SeatView, seat: Seat) -> SeatStats {
    let won = view.tricks_taken.get(seat.index()).copied().unwrap_or(0);
    let total = view.totals.get(seat.index()).copied().unwrap_or(0);
    let total = format!("{total}p");
    match (view.kind, view.hand_type) {
        (GameKind::CanadianSalad, Some(hand)) => {
            let points = salad_points(hand, &view.tricks, view.seats, view.cards_per_player)
                .get(seat.index())
                .copied()
                .unwrap_or(0);
            SeatStats {
                headline: format!("{won}t +{points}"),
                tone: if points > 0 { Tone::Bad } else { Tone::Neutral },
                total,
            }
        }
        _ => {
            let bid = view.bid_of(seat);
            let tricks_left = view.cards_per_player.saturating_sub(view.tricks.len());
            let (headline, tone) = match pace(bid, won, tricks_left) {
                Pace::NoBid => ("bid ?".to_owned(), Tone::Neutral),
                Pace::Need(_) => (format!("{won}/{}", bid.unwrap_or(0)), Tone::Warn),
                Pace::Made => (format!("{won}/{}", bid.unwrap_or(0)), Tone::Good),
                Pace::Over(_) | Pace::Missed => (format!("{won}/{}", bid.unwrap_or(0)), Tone::Bad),
            };
            SeatStats {
                headline,
                tone,
                total,
            }
        }
    }
}

/// Seat roles worth naming on its chip during bidding.
pub fn seat_role(view: &SeatView, seat: Seat) -> Option<&'static str> {
    if view.phase != Phase::Bidding {
        return None;
    }
    match (seat == view.first_actor, seat == view.dealer) {
        (true, true) => Some("Leads + deals"),
        (true, false) => Some("Leads"),
        (false, true) => Some("Dealer"),
        (false, false) => None,
    }
}

/// One line above the hand telling the viewer where they stand.
pub fn your_line(view: &SeatView) -> String {
    let me = view.seat;
    let won = view.tricks_taken.get(me.index()).copied().unwrap_or(0);
    let trick_word = |n: usize| if n == 1 { "trick" } else { "tricks" };
    if let (GameKind::CanadianSalad, Some(hand)) = (view.kind, view.hand_type) {
        let points = salad_points(hand, &view.tricks, view.seats, view.cards_per_player)
            .get(me.index())
            .copied()
            .unwrap_or(0);
        return format!("You: {won} {} taken, +{points} this hand", trick_word(won));
    }
    let tricks_left = view.cards_per_player.saturating_sub(view.tricks.len());
    let bid = view.bid_of(me);
    match pace(bid, won, tricks_left) {
        Pace::NoBid => format!(
            "Bid how many of your {} {} you will win",
            view.cards_per_player,
            trick_word(view.cards_per_player)
        ),
        Pace::Need(n) => format!("You bid {}, won {won}: need {n} more", bid.unwrap_or(0)),
        Pace::Made => format!(
            "You bid {}, won {won}: on target, avoid winning more",
            bid.unwrap_or(0)
        ),
        Pace::Over(n) => format!("You bid {}, won {won}: over by {n}", bid.unwrap_or(0)),
        Pace::Missed => format!(
            "You bid {}, won {won}: can no longer make it",
            bid.unwrap_or(0)
        ),
    }
}

#[cfg(test)]
mod tests {
    use cards_core::{Card, Play, Suit};

    use super::*;

    #[test]
    fn pace_tracks_a_bid_through_the_hand() {
        let cases = [
            (None, 0, 5, Pace::NoBid),
            (Some(2), 0, 5, Pace::Need(2)),
            (Some(2), 1, 1, Pace::Need(1)),
            (Some(2), 2, 3, Pace::Made),
            (Some(0), 0, 5, Pace::Made),
            (Some(1), 3, 0, Pace::Over(2)),
            (Some(3), 1, 1, Pace::Missed),
        ];
        for (bid, won, left, expected) in cases {
            assert_eq!(
                pace(bid, won, left),
                expected,
                "bid {bid:?} won {won} left {left}"
            );
        }
    }

    fn trick(winner: u8, cards: &[(Suit, u8)], seats_from: u8) -> Trick {
        Trick {
            plays: cards
                .iter()
                .enumerate()
                .map(|(i, &(suit, rank))| Play {
                    seat: Seat(seats_from + u8::try_from(i).unwrap()),
                    card: Card { suit, rank },
                })
                .collect(),
            winner: Seat(winner),
        }
    }

    #[test]
    fn salad_points_add_card_penalties_and_only_the_real_last_trick() {
        let hearts = trick(
            1,
            &[(Suit::Hearts, 2), (Suit::Hearts, 9), (Suit::Clubs, 4)],
            0,
        );
        let clean = trick(
            0,
            &[(Suit::Clubs, 2), (Suit::Clubs, 9), (Suit::Clubs, 5)],
            0,
        );

        let mid_hand = salad_points(HandType::NoHearts, &[hearts.clone(), clean.clone()], 3, 17);
        assert_eq!(mid_hand, [0, 20, 0]);

        let no_last = salad_points(
            HandType::NoLastTrick,
            &[hearts.clone(), clean.clone()],
            3,
            17,
        );
        assert_eq!(no_last, [0, 0, 0], "trick 2 of 17 is not the last trick");
        let finished = salad_points(HandType::NoLastTrick, &[hearts, clean], 3, 2);
        assert_eq!(
            finished[0],
            HandType::NoLastTrick.trick_penalty(std::iter::empty(), true)
        );
    }
}
