use cards_core::canadian_salad::rules::HandType;
use cards_core::{Card, GameKind, Play, Seat, Suit, Trick};

#[derive(Clone, Debug, PartialEq)]
pub struct Shown {
    pub plays: Vec<Play>,
    pub winner: Option<Seat>,
    /// Position of this trick within the round, starting at 0.
    pub index: usize,
}

/// Horizontal placement of the fixed trick slots: one per seat, in seat order.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Row {
    pub step: f32,
    pub width: f32,
}

/// The single message in the trick area's status row.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Status {
    YourBid,
    YourPlay,
    YouWonYourLead,
    Won(Seat),
    Waiting { seat: Seat, bidding: bool },
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

/// Slots overlap evenly when the row would be wider than `avail`.
pub fn trick_row(avail: f32, card_w: f32, seats: usize) -> Row {
    if seats <= 1 {
        return Row {
            step: 0.0,
            width: card_w,
        };
    }
    let gaps = (seats - 1) as f32;
    let step = (card_w + 8.0).min(((avail - card_w) / gaps).max(8.0));
    Row {
        step,
        width: step * gaps + card_w,
    }
}

/// How far a card in `slot` moves to reach the centre of the row.
pub fn gather_offset(row: Row, slot: usize, card_w: f32) -> f32 {
    (row.width - card_w) / 2.0 - row.step * slot as f32
}

/// A slight fan for the gathered stack, in degrees, by the order cards were played.
pub fn gather_rotation(order: usize, count: usize) -> f32 {
    let middle = count.saturating_sub(1) as f32 / 2.0;
    (order as f32 - middle) * 4.0
}

pub fn status(
    me: Seat,
    actor: Option<Seat>,
    bidding: bool,
    winner: Option<Seat>,
) -> Option<Status> {
    match (actor, winner) {
        (Some(a), Some(w)) if a == me && w == me => Some(Status::YouWonYourLead),
        (Some(a), _) if a == me && bidding => Some(Status::YourBid),
        (Some(a), _) if a == me => Some(Status::YourPlay),
        (_, Some(w)) => Some(Status::Won(w)),
        (Some(seat), None) => Some(Status::Waiting { seat, bidding }),
        (None, None) => None,
    }
}

/// The trick on the felt: the one in progress, else the last won one until the next card lands.
pub fn displayed_trick(current: &[Play], tricks: &[Trick]) -> Option<Shown> {
    if !current.is_empty() {
        return Some(Shown {
            plays: current.to_vec(),
            winner: None,
            index: tricks.len(),
        });
    }
    tricks.last().map(|t| Shown {
        plays: t.plays.clone(),
        winner: Some(t.winner),
        index: tricks.len() - 1,
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
    fn trick_rows_space_slots_and_overlap_when_narrow() {
        assert_eq!(
            trick_row(800.0, 80.0, 4),
            Row {
                step: 88.0,
                width: 344.0
            }
        );
        assert_eq!(
            trick_row(300.0, 58.0, 7),
            Row {
                step: 242.0 / 6.0,
                width: 300.0
            }
        );
        assert_eq!(trick_row(60.0, 58.0, 7).step, 8.0);
        assert_eq!(
            trick_row(300.0, 58.0, 1),
            Row {
                step: 0.0,
                width: 58.0
            }
        );
    }

    #[test]
    fn gathering_moves_every_slot_to_the_centre() {
        let row = trick_row(800.0, 80.0, 4);
        let centres: Vec<f32> = (0..4)
            .map(|slot| row.step * slot as f32 + gather_offset(row, slot, 80.0))
            .collect();
        assert!(
            centres.iter().all(|c| (c - 132.0).abs() < 0.001),
            "{centres:?}"
        );
        assert_eq!(
            (0..3).map(|o| gather_rotation(o, 3)).collect::<Vec<_>>(),
            [-4.0, 0.0, 4.0]
        );
        assert_eq!(gather_rotation(0, 1), 0.0);
    }

    #[test]
    fn status_shows_one_message_for_the_viewer() {
        let me = Seat(1);
        let cases = [
            (Some(me), true, None, Some(Status::YourBid)),
            (Some(me), false, None, Some(Status::YourPlay)),
            (Some(me), false, Some(me), Some(Status::YouWonYourLead)),
            (
                Some(Seat(2)),
                false,
                Some(Seat(2)),
                Some(Status::Won(Seat(2))),
            ),
            (None, false, Some(Seat(0)), Some(Status::Won(Seat(0)))),
            (
                Some(Seat(3)),
                true,
                None,
                Some(Status::Waiting {
                    seat: Seat(3),
                    bidding: true,
                }),
            ),
            (None, false, None, None),
        ];
        for (actor, bidding, winner, expected) in cases {
            assert_eq!(
                status(me, actor, bidding, winner),
                expected,
                "{actor:?} {winner:?}"
            );
        }
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
        let tricks = [last.clone(), last.clone()];
        let current = [play(1, 2)];
        let live = displayed_trick(&current, &tricks).expect("live trick");
        assert_eq!(
            (live.plays.as_slice(), live.winner, live.index),
            (&current[..], None, 2)
        );

        let won = displayed_trick(&[], &tricks).expect("won trick");
        assert_eq!(
            (won.plays, won.winner, won.index),
            (last.plays, Some(Seat(1)), 1)
        );

        assert!(displayed_trick(&[], &[]).is_none());
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
