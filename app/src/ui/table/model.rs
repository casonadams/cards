use cards_core::canadian_salad::rules::HandType;
use cards_core::{Card, GameKind, Play, Seat, Suit, Trick};

pub struct Shown {
    pub plays: Vec<Play>,
    pub winner: Option<Seat>,
}

pub struct Layout {
    pub step: f32,
    pub start: f32,
}

pub struct Standing {
    pub seat: Seat,
    pub total: i32,
    pub place: usize,
}

pub fn round_title(kind: GameKind, round: usize, total_rounds: usize, label: &str) -> String {
    match kind {
        GameKind::OhWell => format!("Round {} of {total_rounds}", round + 1),
        GameKind::CanadianSalad => format!("Hand {} of {total_rounds}: {label}", round + 1),
    }
}

pub fn penalty_summary(hand: HandType) -> &'static str {
    match hand {
        HandType::NoTricks => "+10 per trick",
        HandType::NoHearts => "+10 per heart",
        HandType::NoQueens => "+25 per queen",
        HandType::NoKingSpades => "+100 king of spades",
        HandType::NoLastTrick => "+100 last trick",
        HandType::Combination => "all penalties",
    }
}

pub fn stat_line(kind: GameKind, bid: Option<u8>, tricks: usize, total: i32) -> String {
    match kind {
        GameKind::OhWell => match bid {
            Some(bid) => format!("{bid} | {total}p"),
            None => format!("- | {total}p"),
        },
        GameKind::CanadianSalad => format!("{tricks}t | {total}p"),
    }
}

pub fn leader(first_actor: Seat, last_winner: Option<Seat>) -> Seat {
    last_winner.unwrap_or(first_actor)
}

pub fn order_number(seat: Seat, leader: Seat, seats: usize) -> usize {
    (seat.index() + seats - leader.index()) % seats + 1
}

pub fn slot_of(seat: Seat, lead: Seat, seats: usize) -> usize {
    order_number(seat, lead, seats) - 1
}

/// The trick on the felt: the one in progress, else the last won one until the next card lands.
pub fn displayed_trick(current: &[Play], last: Option<&Trick>) -> Option<Shown> {
    if !current.is_empty() {
        return Some(Shown {
            plays: current.to_vec(),
            winner: None,
        });
    }
    last.map(|t| Shown {
        plays: t.plays.clone(),
        winner: Some(t.winner),
    })
}

pub fn hand_layout(avail: f32, card_w: f32, count: usize, gap: f32, pad: f32) -> Layout {
    if count <= 1 {
        return Layout {
            step: 0.0,
            start: ((avail - card_w) / 2.0).max(0.0),
        };
    }
    let gaps = (count - 1) as f32;
    let total = card_w + gaps * (card_w + gap);
    if total <= avail - 2.0 * pad {
        return Layout {
            step: card_w + gap,
            start: (avail - total) / 2.0,
        };
    }
    Layout {
        step: ((avail - 2.0 * pad - card_w) / gaps).max(0.0),
        start: pad,
    }
}

pub fn card_badge(hand: Option<HandType>, trump: Option<Suit>, card: Card) -> Option<String> {
    let penalty = hand.map_or(0, |h| h.card_penalty(card));
    if penalty > 0 {
        return Some(format!("+{penalty}"));
    }
    (hand.is_none() && trump == Some(card.suit)).then(|| "T".to_owned())
}

/// Places by total; ties share a place. Oh Well rewards the highest total, Canadian Salad the lowest.
pub fn standings(kind: GameKind, totals: &[i32]) -> Vec<Standing> {
    let mut rows: Vec<(Seat, i32)> = totals
        .iter()
        .enumerate()
        .map(|(i, t)| (Seat::from_index(i), *t))
        .collect();
    match kind {
        GameKind::OhWell => rows.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0))),
        GameKind::CanadianSalad => rows.sort_by(|a, b| a.1.cmp(&b.1).then(a.0.cmp(&b.0))),
    }
    let mut place = 0;
    let mut previous = None;
    rows.iter()
        .enumerate()
        .map(|(i, (seat, total))| {
            if previous != Some(*total) {
                place = i + 1;
                previous = Some(*total);
            }
            Standing {
                seat: *seat,
                total: *total,
                place,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn card(suit: Suit, rank: u8) -> Card {
        Card { suit, rank }
    }

    fn play(seat: u8, rank: u8) -> Play {
        Play {
            seat: Seat(seat),
            card: card(Suit::Clubs, rank),
        }
    }

    #[test]
    fn order_numbers_start_at_the_leader_and_wrap() {
        let cases = [
            (4, 0, [1, 2, 3, 4]),
            (4, 2, [3, 4, 1, 2]),
            (4, 3, [2, 3, 4, 1]),
        ];
        for (seats, lead, expected) in cases {
            let numbers: Vec<usize> = (0..seats)
                .map(|s| order_number(Seat::from_index(s), Seat(lead), seats))
                .collect();
            assert_eq!(numbers, expected, "leader {lead}");
        }
    }

    #[test]
    fn leader_is_the_first_actor_until_a_trick_is_won() {
        assert_eq!(leader(Seat(1), None), Seat(1));
        assert_eq!(leader(Seat(1), Some(Seat(3))), Seat(3));
    }

    #[test]
    fn slots_are_relative_to_the_trick_leader() {
        assert_eq!(slot_of(Seat(2), Seat(2), 5), 0);
        assert_eq!(slot_of(Seat(0), Seat(2), 5), 3);
        assert_eq!(slot_of(Seat(1), Seat(2), 5), 4);
    }

    #[test]
    fn stat_lines_follow_each_game() {
        assert_eq!(stat_line(GameKind::OhWell, Some(2), 1, 12), "2 | 12p");
        assert_eq!(stat_line(GameKind::OhWell, None, 0, -3), "- | -3p");
        assert_eq!(stat_line(GameKind::CanadianSalad, None, 3, 45), "3t | 45p");
    }

    #[test]
    fn round_titles_follow_each_game() {
        assert_eq!(
            round_title(GameKind::CanadianSalad, 2, 6, "No Queens"),
            "Hand 3 of 6: No Queens"
        );
        assert_eq!(
            round_title(GameKind::OhWell, 3, 19, "Round 4"),
            "Round 4 of 19"
        );
    }

    #[test]
    fn displayed_trick_prefers_current_then_last_won() {
        let last = Trick {
            plays: vec![play(0, 5), play(1, 9)],
            winner: Seat(1),
        };
        let current = [play(1, 2)];
        let live = displayed_trick(&current, Some(&last)).expect("live trick");
        assert_eq!(live.plays, current);
        assert_eq!(live.winner, None);

        let won = displayed_trick(&[], Some(&last)).expect("won trick");
        assert_eq!(won.plays, last.plays);
        assert_eq!(won.winner, Some(Seat(1)));

        assert!(displayed_trick(&[], None).is_none());
    }

    #[test]
    fn layout_centres_hands_that_fit_and_overlaps_those_that_do_not() {
        let fit = hand_layout(400.0, 50.0, 3, 6.0, 8.0);
        assert_eq!((fit.step, fit.start), (56.0, 119.0));

        let tight = hand_layout(300.0, 50.0, 10, 6.0, 8.0);
        assert_eq!(tight.start, 8.0);
        assert!((tight.step - 26.0).abs() < 0.001);
        assert!((tight.start + 9.0 * tight.step + 50.0 - 292.0).abs() < 0.001);

        let one = hand_layout(300.0, 50.0, 1, 6.0, 8.0);
        assert_eq!((one.step, one.start), (0.0, 125.0));

        let none = hand_layout(300.0, 50.0, 0, 6.0, 8.0);
        assert_eq!(none.step, 0.0);

        let huge = hand_layout(30.0, 50.0, 4, 6.0, 8.0);
        assert_eq!(huge.step, 0.0);
    }

    #[test]
    fn card_badges_show_penalties_and_trumps() {
        let queen = card(Suit::Spades, 12);
        let heart = card(Suit::Hearts, 5);
        let king = card(Suit::Spades, 13);
        assert_eq!(
            card_badge(Some(HandType::NoQueens), None, queen).as_deref(),
            Some("+25")
        );
        assert_eq!(
            card_badge(Some(HandType::NoHearts), None, heart).as_deref(),
            Some("+10")
        );
        assert_eq!(
            card_badge(Some(HandType::Combination), None, king).as_deref(),
            Some("+100")
        );
        assert_eq!(card_badge(Some(HandType::NoQueens), None, heart), None);
        assert_eq!(
            card_badge(None, Some(Suit::Hearts), heart).as_deref(),
            Some("T")
        );
        assert_eq!(card_badge(None, Some(Suit::Hearts), queen), None);
    }

    #[test]
    fn standings_reward_high_totals_in_oh_well_and_low_in_salad() {
        let totals = [10, 30, 30, -5];
        let seats = |kind| -> Vec<(usize, usize)> {
            standings(kind, &totals)
                .iter()
                .map(|s| (s.seat.index(), s.place))
                .collect()
        };
        assert_eq!(seats(GameKind::OhWell), [(1, 1), (2, 1), (0, 3), (3, 4)]);
        assert_eq!(
            seats(GameKind::CanadianSalad),
            [(3, 1), (0, 2), (1, 3), (2, 3)]
        );
    }
}
