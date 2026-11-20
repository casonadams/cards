mod common;
use cards_core::{Action, GameKind, Phase, Rng, Seat, SeatView, Table, ai};
use common::*;

fn step(table: &mut Table, rng: &mut Rng) {
    match table.phase() {
        Phase::RoundOver => {
            table.start_next_round().unwrap();
        }
        Phase::GameOver => {}
        _ => {
            let seat = table.actor().unwrap();
            let action = ai::choose(&table.view(seat), rng);
            table.apply(seat, action).unwrap();
        }
    }
}

#[test]
fn views_never_leak_other_hands_or_seed() {
    for (kind, counts) in KINDS {
        for seats in counts {
            let mut table = Table::new(kind, seats, 77).unwrap();
            let mut rng = Rng::new(1);
            for n in 0..400 {
                if n % 7 == 0 {
                    for i in 0..seats {
                        let view = table.view(Seat(i as u8));
                        let json = serde_json::to_string(&view).unwrap();
                        assert!(!json.contains("seed"));
                        assert_eq!(view.hand_sizes.len(), seats);
                        let public: Vec<_> = view
                            .tricks
                            .iter()
                            .flat_map(|t| t.plays.iter().map(|p| p.card))
                            .chain(view.current_trick.iter().map(|p| p.card))
                            .chain(view.trump_card)
                            .collect();
                        for j in (0..seats).filter(|j| *j != i) {
                            let theirs = table.view(Seat(j as u8)).hand;
                            for c in theirs {
                                assert!(!view.hand.contains(&c), "own hand holds foreign card");
                                if !public.contains(&c) {
                                    let needle = serde_json::to_string(&c).unwrap();
                                    assert!(!json.contains(&needle), "leaked {needle}");
                                }
                            }
                        }
                    }
                }
                step(&mut table, &mut rng);
            }
        }
    }
}

#[test]
fn view_fields_describe_round_state() {
    let table = Table::new(GameKind::OhWell, 5, 3).unwrap();
    let view = table.view(Seat(2));
    assert_eq!(view.dealer, Seat(0));
    assert_eq!(view.first_actor, Seat(1));
    assert_eq!(view.hand_sizes, vec![10; 5]);
    assert_eq!(view.trump_suit, view.trump_card.map(|c| c.suit));
    assert!(view.playable_cards.is_empty());
    assert!(view.legal_bids.is_empty());
    let actor_view = table.view(Seat(1));
    assert_eq!(actor_view.legal_bids.len(), 11);
    let trump = actor_view.trump_suit.unwrap();
    let first_non_trump = actor_view.hand.iter().position(|c| c.suit != trump);
    let last_trump = actor_view.hand.iter().rposition(|c| c.suit == trump);
    if let (Some(n), Some(t)) = (first_non_trump, last_trump) {
        assert!(t < n, "trump sorted first");
    }
}

#[test]
fn table_serde_round_trip_resumes_identically() {
    for (kind, seats) in [(GameKind::OhWell, 4), (GameKind::CanadianSalad, 5)] {
        let mut a = Table::new(kind, seats, 5).unwrap();
        let mut rng_a = Rng::new(3);
        for _ in 0..37 {
            step(&mut a, &mut rng_a);
        }
        let json = serde_json::to_string(&a).unwrap();
        let mut b: Table = serde_json::from_str(&json).unwrap();
        assert_eq!(a, b);
        let mut rng_b = rng_a.clone();
        for _ in 0..200 {
            step(&mut a, &mut rng_a);
            step(&mut b, &mut rng_b);
        }
        assert_eq!(a, b);
        let view: SeatView = a.view(Seat(0));
        let back: SeatView = serde_json::from_str(&serde_json::to_string(&view).unwrap()).unwrap();
        assert_eq!(view, back);
    }
}

#[test]
fn same_seed_is_deterministic_and_seeds_differ() {
    let a = Table::new(GameKind::OhWell, 4, 1).unwrap();
    let b = Table::new(GameKind::OhWell, 4, 1).unwrap();
    let c = Table::new(GameKind::OhWell, 4, 2).unwrap();
    assert_eq!(a, b);
    assert_ne!(a.view(Seat(0)).hand, c.view(Seat(0)).hand);
}

#[test]
fn legal_actions_only_for_actor() {
    let table = Table::new(GameKind::CanadianSalad, 4, 1).unwrap();
    let actor = table.actor().unwrap();
    for i in 0..4 {
        let acts = table.legal_actions(Seat(i));
        assert_eq!(acts.is_empty(), Seat(i) != actor);
    }
    assert!(
        table
            .legal_actions(actor)
            .iter()
            .all(|a| matches!(a, Action::Play(_)))
    );
}
