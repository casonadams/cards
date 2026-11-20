use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum Suit {
    Clubs,
    Diamonds,
    Hearts,
    Spades,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct Card {
    pub suit: Suit,
    pub rank: u8,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct Seat(pub u8);

impl Seat {
    pub fn index(self) -> usize {
        usize::from(self.0)
    }

    pub fn from_index(index: usize) -> Seat {
        Seat(u8::try_from(index).unwrap_or(u8::MAX))
    }
}

pub const ACE: u8 = 14;

pub fn full_deck() -> Vec<Card> {
    [Suit::Hearts, Suit::Diamonds, Suit::Clubs, Suit::Spades]
        .into_iter()
        .flat_map(|suit| (2..=ACE).map(move |rank| Card { suit, rank }))
        .collect()
}

fn suit_order(suit: Suit, trump: Option<Suit>) -> i8 {
    let base = match suit {
        Suit::Spades => 0,
        Suit::Hearts => 1,
        Suit::Diamonds => 2,
        Suit::Clubs => 3,
    };
    if trump == Some(suit) { base - 10 } else { base }
}

pub fn sort_hand(hand: &mut [Card], trump: Option<Suit>) {
    hand.sort_by(|a, b| {
        suit_order(a.suit, trump)
            .cmp(&suit_order(b.suit, trump))
            .then(b.rank.cmp(&a.rank))
    });
}

pub fn remove_card(cards: &mut Vec<Card>, card: Card) -> bool {
    match cards.iter().position(|c| *c == card) {
        Some(i) => {
            cards.remove(i);
            true
        }
        None => false,
    }
}
