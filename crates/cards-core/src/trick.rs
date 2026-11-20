use serde::{Deserialize, Serialize};

use crate::action::Rejection;
use crate::card::{Card, Seat, Suit};

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct Play {
    pub seat: Seat,
    pub card: Card,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct Trick {
    pub plays: Vec<Play>,
    pub winner: Seat,
}

fn strength(card: Card, led: Suit, trump: Option<Suit>) -> i32 {
    if trump == Some(card.suit) {
        100 + i32::from(card.rank)
    } else if card.suit == led {
        i32::from(card.rank)
    } else {
        -1
    }
}

/// Highest trump wins, else highest card of the led suit; the earliest play wins ties.
pub fn winner(plays: &[Play], trump: Option<Suit>) -> Option<Play> {
    let first = *plays.first()?;
    let led = first.card.suit;
    let mut best = first;
    for play in &plays[1..] {
        if strength(play.card, led, trump) > strength(best.card, led, trump) {
            best = *play;
        }
    }
    Some(best)
}

pub fn legal_cards(hand: &[Card], led: Option<Suit>) -> Vec<Card> {
    match led {
        Some(suit) if hand.iter().any(|c| c.suit == suit) => {
            hand.iter().copied().filter(|c| c.suit == suit).collect()
        }
        _ => hand.to_vec(),
    }
}

pub fn check_play(hand: &[Card], card: Card, led: Option<Suit>) -> Result<(), Rejection> {
    if !hand.contains(&card) {
        return Err(Rejection::CardNotInHand);
    }
    match led {
        Some(suit) if card.suit != suit && hand.iter().any(|c| c.suit == suit) => {
            Err(Rejection::MustFollowSuit { led: suit })
        }
        _ => Ok(()),
    }
}
