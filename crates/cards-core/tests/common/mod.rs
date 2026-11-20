#![allow(dead_code)]
use cards_core::{Action, Card, Event, GameKind, Phase, Rng, Seat, Table, ai};

pub fn card(suit: cards_core::Suit, rank: u8) -> Card {
    Card { suit, rank }
}

pub struct Outcome {
    pub events: Vec<Event>,
    pub rounds: usize,
}

/// Plays every seat with the AI until the game ends, checking card conservation each step.
pub fn play_game(table: &mut Table, rng: &mut Rng) -> Outcome {
    let mut events = Vec::new();
    let mut rounds = 1;
    loop {
        match table.phase() {
            Phase::GameOver => return Outcome { events, rounds },
            Phase::RoundOver => {
                events.extend(table.start_next_round().expect("next round"));
                rounds += 1;
            }
            _ => {
                let seat = table.actor().expect("actor");
                let action = ai::choose(&table.view(seat), rng);
                events.extend(table.apply(seat, action).expect("ai action accepted"));
                assert_conserved(table);
            }
        }
    }
}

pub fn assert_conserved(table: &Table) {
    let in_hands: usize = (0..table.seats())
        .map(|i| table.view(Seat(i as u8)).hand.len())
        .sum();
    let view = table.view(Seat(0));
    let on_table: usize = view.current_trick.len() + view.tricks.len() * table.seats();
    let expected = table.seats() * view.cards_per_player;
    assert_eq!(in_hands + on_table, expected);
}

pub fn first_action(table: &Table) -> (Seat, Action) {
    let seat = table.actor().unwrap();
    (seat, table.legal_actions(seat)[0])
}

pub const KINDS: [(GameKind, std::ops::RangeInclusive<usize>); 2] =
    [(GameKind::OhWell, 3..=7), (GameKind::CanadianSalad, 3..=6)];
