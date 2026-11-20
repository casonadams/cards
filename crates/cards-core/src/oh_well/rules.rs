use crate::action::Bid;
use crate::card::{Card, full_deck};
use crate::rng::Rng;

pub const EXACT_BID_BONUS: i32 = 10;
pub const RULES_TEXT: &str = "Predict exact tricks. Exact bid = +10 bonus + 1 pt per trick; missed bid = 0 pts. Must follow led suit if able; trump beats led suit.";

pub fn max_cards(seats: usize) -> usize {
    match seats {
        3..=5 => 10,
        6 => 8,
        _ => 7,
    }
}

pub fn total_rounds(seats: usize) -> usize {
    max_cards(seats) * 2 - 1
}

pub fn cards_for_round(round: usize, seats: usize) -> usize {
    let max = max_cards(seats);
    if round < max {
        max - round
    } else if round < total_rounds(seats) {
        round - max + 2
    } else {
        max
    }
}

/// The only amount the last bidder may not bid, if it exists.
pub fn hook_bid(existing: &[Bid], seats: usize, cards: usize) -> Option<u8> {
    if existing.len() + 1 != seats {
        return None;
    }
    let total: usize = existing.iter().map(|b| usize::from(b.amount)).sum();
    let hook = cards.checked_sub(total)?;
    u8::try_from(hook).ok()
}

pub fn score_round(bids: &[Bid], tricks_taken: &[usize], seats: usize) -> Vec<i32> {
    let mut scores = vec![0; seats];
    for bid in bids {
        let taken = tricks_taken.get(bid.seat.index()).copied().unwrap_or(0);
        if taken == usize::from(bid.amount) {
            scores[bid.seat.index()] = EXACT_BID_BONUS + i32::from(bid.amount);
        }
    }
    scores
}

pub struct Deal {
    pub hands: Vec<Vec<Card>>,
    pub trump_card: Option<Card>,
}

pub fn deal(seats: usize, round: usize, seed: u64) -> Deal {
    let cards = cards_for_round(round, seats);
    let mut deck = full_deck();
    Rng::new(seed.wrapping_add(round as u64)).shuffle(&mut deck);
    let mut hands = vec![Vec::with_capacity(cards); seats];
    for (i, card) in deck.iter().take(seats * cards).enumerate() {
        hands[i % seats].push(*card);
    }
    Deal {
        hands,
        trump_card: deck.get(seats * cards).copied(),
    }
}
