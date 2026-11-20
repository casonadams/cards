use serde::{Deserialize, Serialize};

use crate::card::{Card, Seat, Suit, full_deck};
use crate::rng::Rng;
use crate::trick::Trick;

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum HandType {
    NoTricks,
    NoHearts,
    NoQueens,
    NoKingSpades,
    NoLastTrick,
    Combination,
}

pub const HAND_SEQUENCE: [HandType; 6] = [
    HandType::NoTricks,
    HandType::NoHearts,
    HandType::NoQueens,
    HandType::NoKingSpades,
    HandType::NoLastTrick,
    HandType::Combination,
];

impl HandType {
    pub fn label(self) -> &'static str {
        match self {
            HandType::NoTricks => "No Tricks",
            HandType::NoHearts => "No Hearts",
            HandType::NoQueens => "No Queens",
            HandType::NoKingSpades => "No King of Spades",
            HandType::NoLastTrick => "No Last Trick",
            HandType::Combination => "Combination",
        }
    }

    pub fn rules(self) -> &'static str {
        match self {
            HandType::NoTricks => {
                "Avoid winning tricks: +10 penalty pts per trick. (Lowest total score wins)"
            }
            HandType::NoHearts => "Avoid hearts: +10 penalty pts per heart card collected.",
            HandType::NoQueens => "Avoid queens: +25 penalty pts per Queen collected.",
            HandType::NoKingSpades => {
                "Avoid the King of Spades: +100 penalty pts for collecting the K of Spades."
            }
            HandType::NoLastTrick => {
                "Avoid the final trick: +100 penalty pts for winning the last trick of the hand."
            }
            HandType::Combination => {
                "All penalties active: Tricks (+10), Hearts (+10 ea), Queens (+25 ea), K of Spades (+100), Last Trick (+100)."
            }
        }
    }

    pub fn penalizes_tricks(self) -> bool {
        matches!(self, HandType::NoTricks | HandType::Combination)
    }

    pub fn penalizes_last_trick(self) -> bool {
        matches!(self, HandType::NoLastTrick | HandType::Combination)
    }

    pub fn card_penalty(self, card: Card) -> i32 {
        let hearts = matches!(self, HandType::NoHearts | HandType::Combination);
        let queens = matches!(self, HandType::NoQueens | HandType::Combination);
        let king = matches!(self, HandType::NoKingSpades | HandType::Combination);
        let mut penalty = 0;
        if hearts && card.suit == Suit::Hearts {
            penalty += 10;
        }
        if queens && card.rank == 12 {
            penalty += 25;
        }
        if king && card.suit == Suit::Spades && card.rank == 13 {
            penalty += 100;
        }
        penalty
    }

    pub fn trick_penalty(self, cards: impl Iterator<Item = Card>, is_last: bool) -> i32 {
        let mut penalty = 0;
        if self.penalizes_tricks() {
            penalty += 10;
        }
        if is_last && self.penalizes_last_trick() {
            penalty += 100;
        }
        penalty + cards.map(|c| self.card_penalty(c)).sum::<i32>()
    }
}

pub fn removed_cards(seats: usize) -> Vec<Card> {
    let c = |suit, rank| Card { suit, rank };
    match seats {
        3 => vec![c(Suit::Clubs, 2)],
        5 => vec![c(Suit::Clubs, 2), c(Suit::Diamonds, 2)],
        6 => vec![
            c(Suit::Clubs, 2),
            c(Suit::Clubs, 3),
            c(Suit::Diamonds, 2),
            c(Suit::Diamonds, 3),
        ],
        _ => Vec::new(),
    }
}

pub fn cards_per_player(seats: usize) -> usize {
    (52 - removed_cards(seats).len()) / seats
}

pub fn score_hand(hand: HandType, tricks: &[Trick], seats: usize) -> Vec<i32> {
    let mut scores = vec![0; seats];
    let last = tricks.len().saturating_sub(1);
    for (i, trick) in tricks.iter().enumerate() {
        scores[trick.winner.index()] +=
            hand.trick_penalty(trick.plays.iter().map(|p| p.card), i == last);
    }
    scores
}

pub fn deal(seats: usize, round: usize, seed: u64) -> Vec<Vec<Card>> {
    let removed = removed_cards(seats);
    let mut deck: Vec<Card> = full_deck()
        .into_iter()
        .filter(|c| !removed.contains(c))
        .collect();
    Rng::new(seed.wrapping_add(round as u64)).shuffle(&mut deck);
    let per = deck.len() / seats;
    deck.chunks(per).take(seats).map(<[Card]>::to_vec).collect()
}

pub fn first_leader(dealer: Seat, seats: usize) -> Seat {
    Seat::from_index((dealer.index() + 1) % seats)
}
