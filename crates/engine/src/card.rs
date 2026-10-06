use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Suit {
    Clubs,
    Diamonds,
    Hearts,
    Spades,
}

impl Suit {
    pub const ALL: [Suit; 4] = [Suit::Clubs, Suit::Diamonds, Suit::Hearts, Suit::Spades];
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct Rank(pub u8);

impl Rank {
    pub const TWO: Rank = Rank(2);
    pub const THREE: Rank = Rank(3);
    pub const FOUR: Rank = Rank(4);
    pub const FIVE: Rank = Rank(5);
    pub const SIX: Rank = Rank(6);
    pub const SEVEN: Rank = Rank(7);
    pub const EIGHT: Rank = Rank(8);
    pub const NINE: Rank = Rank(9);
    pub const TEN: Rank = Rank(10);
    pub const JACK: Rank = Rank(11);
    pub const QUEEN: Rank = Rank(12);
    pub const KING: Rank = Rank(13);
    pub const ACE: Rank = Rank(14);
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Card {
    pub suit: Suit,
    pub rank: u8,
}

impl Card {
    pub const fn new(suit: Suit, rank: u8) -> Self {
        Self { suit, rank }
    }
}

pub fn create_deck() -> Vec<Card> {
    let mut deck = Vec::with_capacity(52);
    for suit in Suit::ALL {
        for rank in 2..=14 {
            deck.push(Card::new(suit, rank));
        }
    }
    deck
}

/// 32-bit Linear Congruential Generator matching garden-salad's seeded-random.ts
#[derive(Debug, Clone)]
pub struct SeededRng {
    state: u32,
}

impl SeededRng {
    pub fn new(seed: u32) -> Self {
        Self { state: seed }
    }

    pub fn next_f64(&mut self) -> f64 {
        self.state = self.state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
        (self.state as f64) / (u32::MAX as f64)
    }

    pub fn shuffle<T: Clone>(&mut self, items: &[T]) -> Vec<T> {
        let mut result = items.to_vec();
        if result.is_empty() {
            return result;
        }
        for i in (1..result.len()).rev() {
            let j = (self.next_f64() * (i as f64 + 1.0)).floor() as usize;
            result.swap(i, j);
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_deck_size() {
        let deck = create_deck();
        assert_eq!(deck.len(), 52);
    }

    #[test]
    fn test_seeded_rng_deterministic() {
        let mut rng1 = SeededRng::new(12345);
        let mut rng2 = SeededRng::new(12345);
        let deck = create_deck();
        let shuffled1 = rng1.shuffle(&deck);
        let shuffled2 = rng2.shuffle(&deck);
        assert_eq!(shuffled1, shuffled2);
    }
}
