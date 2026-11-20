mod common;
use cards_core::canadian_salad::rules as salad;
use cards_core::oh_well::rules as oh_well;
use cards_core::{Action, Event, GameKind, Phase, Rejection, Rng, Seat, Suit, Table};
use common::*;

#[test]
fn oh_well_cards_per_round_schedule() {
    let cases: [(usize, Vec<usize>); 5] = [
        (
            3,
            vec![10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        ),
        (
            4,
            vec![10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        ),
        (
            5,
            vec![10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        ),
        (6, vec![8, 7, 6, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6, 7, 8]),
        (7, vec![7, 6, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6, 7]),
    ];
    for (seats, expected) in cases {
        assert_eq!(
            oh_well::total_rounds(seats),
            expected.len(),
            "{seats} seats"
        );
        let actual: Vec<usize> = (0..expected.len())
            .map(|r| oh_well::cards_for_round(r, seats))
            .collect();
        assert_eq!(actual, expected, "{seats} seats");
    }
}

fn bid_all_but_last(table: &mut Table, amount: u8) -> Seat {
    while table.view(table.actor().unwrap()).bids.len() + 1 < table.seats() {
        let seat = table.actor().unwrap();
        table.apply(seat, Action::Bid(amount)).unwrap();
    }
    table.actor().unwrap()
}

#[test]
fn hook_rule_rejects_total_making_bid() {
    let mut table = Table::new(GameKind::OhWell, 4, 7).unwrap();
    let cards = table.view(Seat(0)).cards_per_player as u8;
    let dealer = table.dealer();
    let last = bid_all_but_last(&mut table, 1);
    assert_eq!(last, dealer);
    let hook = cards - 3;
    assert_eq!(
        table.apply(last, Action::Bid(hook)),
        Err(Rejection::HookBid { forbidden: hook })
    );
    let view = table.view(last);
    assert!(!view.legal_bids.contains(&hook));
    assert_eq!(view.legal_bids.len(), usize::from(cards));
    assert!(table.apply(last, Action::Bid(hook + 1)).is_ok());
    assert_eq!(table.phase(), Phase::Playing);
}

#[test]
fn hook_does_not_apply_before_last_bidder() {
    let table = Table::new(GameKind::OhWell, 4, 7).unwrap();
    let seat = table.actor().unwrap();
    let all = table.legal_actions(seat).len();
    assert_eq!(all, table.view(seat).cards_per_player + 1);
}

#[test]
fn bid_validation_and_turn_order() {
    let mut table = Table::new(GameKind::OhWell, 3, 1).unwrap();
    let actor = table.actor().unwrap();
    assert_eq!(actor, Seat(1));
    let other = Seat(2);
    assert_eq!(
        table.apply(other, Action::Bid(0)),
        Err(Rejection::NotYourTurn)
    );
    assert_eq!(
        table.apply(actor, Action::Bid(11)),
        Err(Rejection::BidOutOfRange { max: 10 })
    );
    let card = table.view(actor).hand[0];
    assert_eq!(
        table.apply(actor, Action::Play(card)),
        Err(Rejection::WrongPhase)
    );
    assert_eq!(
        table.apply(Seat(9), Action::Bid(0)),
        Err(Rejection::UnknownSeat)
    );
    assert_eq!(table.start_next_round(), Err(Rejection::WrongPhase));
}

#[test]
fn unsupported_seat_counts_are_rejected() {
    assert!(Table::new(GameKind::OhWell, 2, 0).is_err());
    assert!(Table::new(GameKind::OhWell, 8, 0).is_err());
    assert!(Table::new(GameKind::CanadianSalad, 7, 0).is_err());
}

fn play_out_bidding(table: &mut Table) {
    while table.phase() == Phase::Bidding {
        let (seat, action) = first_action(table);
        table.apply(seat, action).unwrap();
    }
}

#[test]
fn follow_suit_is_enforced() {
    for kind in [GameKind::OhWell, GameKind::CanadianSalad] {
        let mut table = Table::new(kind, 4, 3).unwrap();
        play_out_bidding(&mut table);
        let (seat, action) = first_action(&table);
        table.apply(seat, action).unwrap();
        let Action::Play(led) = action else { panic!() };
        let next = table.actor().unwrap();
        let view = table.view(next);
        let has_led = view.hand.iter().any(|c| c.suit == led.suit);
        for c in &view.hand {
            let mut probe = table.clone();
            let result = probe.apply(next, Action::Play(*c));
            if has_led && c.suit != led.suit {
                assert_eq!(result, Err(Rejection::MustFollowSuit { led: led.suit }));
            } else {
                assert!(result.is_ok());
            }
        }
        let foreign = common::card(led.suit, 99);
        assert_eq!(
            table.clone().apply(next, Action::Play(foreign)),
            Err(Rejection::CardNotInHand)
        );
    }
}

fn first_trick_winner(table: &mut Table) -> (Vec<cards_core::Play>, Seat) {
    let mut events = Vec::new();
    while events.is_empty() {
        let (seat, action) = first_action(table);
        for e in table.apply(seat, action).unwrap() {
            if let Event::TrickWon { winner, cards } = e {
                events.push((cards, winner));
            }
        }
    }
    events.remove(0)
}

#[test]
fn trick_winner_respects_trump_and_led_suit() {
    for seed in 0..40 {
        let mut table = Table::new(GameKind::OhWell, 4, seed).unwrap();
        let trump = table.view(Seat(0)).trump_suit;
        play_out_bidding(&mut table);
        let (plays, winner) = first_trick_winner(&mut table);
        let led = plays[0].card.suit;
        let key = |p: &cards_core::Play| {
            if Some(p.card.suit) == trump {
                100 + u32::from(p.card.rank)
            } else if p.card.suit == led {
                u32::from(p.card.rank)
            } else {
                0
            }
        };
        let best = plays.iter().max_by_key(|p| key(p)).unwrap();
        assert_eq!(winner, best.seat);
    }
}

#[test]
fn canadian_salad_has_no_trump_so_off_suit_never_wins() {
    let mut table = Table::new(GameKind::CanadianSalad, 4, 11).unwrap();
    let (plays, winner) = first_trick_winner(&mut table);
    let led = plays[0].card.suit;
    let best = plays
        .iter()
        .filter(|p| p.card.suit == led)
        .max_by_key(|p| p.card.rank)
        .unwrap();
    assert_eq!(winner, best.seat);
}

#[test]
fn oh_well_exact_bid_scoring() {
    use cards_core::Bid;
    let bids = [
        Bid {
            seat: Seat(0),
            amount: 2,
        },
        Bid {
            seat: Seat(1),
            amount: 0,
        },
        Bid {
            seat: Seat(2),
            amount: 1,
        },
        Bid {
            seat: Seat(3),
            amount: 0,
        },
    ];
    let scores = oh_well::score_round(&bids, &[2, 1, 1, 0], 4);
    assert_eq!(scores, vec![12, 0, 11, 10]);
}

#[test]
fn canadian_salad_deal_sizes_and_removed_cards() {
    let cases = [(3, 17, 1), (4, 13, 0), (5, 10, 2), (6, 8, 4)];
    for (seats, per, removed) in cases {
        assert_eq!(salad::cards_per_player(seats), per);
        assert_eq!(salad::removed_cards(seats).len(), removed);
        let table = Table::new(GameKind::CanadianSalad, seats, 5).unwrap();
        let mut all = Vec::new();
        for i in 0..seats {
            let view = table.view(Seat(i as u8));
            assert_eq!(view.hand.len(), per);
            all.extend(view.hand);
        }
        let unique: std::collections::HashSet<_> = all.iter().copied().collect();
        assert_eq!(unique.len(), seats * per);
        for r in salad::removed_cards(seats) {
            assert!(!unique.contains(&r));
        }
        assert_eq!(seats * per + removed, 52);
    }
}

fn trick(winner: u8, cards: &[(Suit, u8)]) -> cards_core::Trick {
    cards_core::Trick {
        plays: cards
            .iter()
            .enumerate()
            .map(|(i, (s, r))| cards_core::Play {
                seat: Seat(i as u8),
                card: common::card(*s, *r),
            })
            .collect(),
        winner: Seat(winner),
    }
}

#[test]
fn canadian_salad_penalties_per_hand_type() {
    use salad::HandType::*;
    let tricks = vec![
        trick(
            0,
            &[(Suit::Hearts, 5), (Suit::Hearts, 3), (Suit::Spades, 12)],
        ),
        trick(
            1,
            &[(Suit::Spades, 13), (Suit::Spades, 2), (Suit::Hearts, 12)],
        ),
        trick(0, &[(Suit::Clubs, 9), (Suit::Clubs, 3), (Suit::Hearts, 7)]),
    ];
    let cases = [
        (NoTricks, vec![20, 10, 0]),
        (NoHearts, vec![30, 10, 0]),
        (NoQueens, vec![25, 25, 0]),
        (NoKingSpades, vec![0, 100, 0]),
        (NoLastTrick, vec![100, 0, 0]),
        (Combination, vec![20 + 30 + 25 + 100, 10 + 10 + 25 + 100, 0]),
    ];
    for (hand, expected) in cases {
        assert_eq!(salad::score_hand(hand, &tricks, 3), expected, "{hand:?}");
    }
}

#[test]
fn full_games_complete_for_every_player_count() {
    for (kind, counts) in KINDS {
        for seats in counts {
            let mut table = Table::new(kind, seats, 100 + seats as u64).unwrap();
            let mut rng = Rng::new(9);
            let outcome = play_game(&mut table, &mut rng);
            assert_eq!(outcome.rounds, kind.total_rounds(seats));
            let ended = outcome
                .events
                .iter()
                .filter(|e| matches!(e, Event::GameEnded { .. }))
                .count();
            assert_eq!(ended, 1, "{kind:?} {seats}");
            assert_eq!(table.phase(), Phase::GameOver);
            assert_eq!(table.actor(), None);
            let view = table.view(Seat(0));
            assert!(view.game_over && view.round_over);
            assert_eq!(view.round_scores.len(), outcome.rounds);
            assert_eq!(table.start_next_round(), Err(Rejection::WrongPhase));
        }
    }
}
