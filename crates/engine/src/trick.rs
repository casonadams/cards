use crate::card::{Card, Suit};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TrickPlay {
    pub player_id: String,
    pub card: Card,
}

pub fn resolve_trick(plays: &[TrickPlay], led_suit: Suit, trump_suit: Option<Suit>) -> Option<usize> {
    if plays.is_empty() {
        return None;
    }

    let mut winning_idx = 0;
    let mut best_card = plays[0].card;

    for (i, play) in plays.iter().enumerate().skip(1) {
        if card_beats(play.card, best_card, led_suit, trump_suit) {
            winning_idx = i;
            best_card = play.card;
        }
    }

    Some(winning_idx)
}

fn card_beats(candidate: Card, current_best: Card, led_suit: Suit, trump_suit: Option<Suit>) -> bool {
    let candidate_is_trump = Some(candidate.suit) == trump_suit;
    let best_is_trump = Some(current_best.suit) == trump_suit;

    if candidate_is_trump && !best_is_trump {
        return true;
    }
    if !candidate_is_trump && best_is_trump {
        return false;
    }
    if candidate_is_trump && best_is_trump {
        return candidate.rank > current_best.rank;
    }

    if candidate.suit == led_suit && current_best.suit == led_suit {
        return candidate.rank > current_best.rank;
    }
    if candidate.suit == led_suit && current_best.suit != led_suit {
        return true;
    }

    false
}

pub fn validate_follow_suit(hand: &[Card], card: Card, led_suit: Option<Suit>) -> Result<(), &'static str> {
    if !hand.contains(&card) {
        return Err("Card not in hand");
    }

    if let Some(led) = led_suit {
        let has_led_suit = hand.iter().any(|c| c.suit == led);
        if has_led_suit && card.suit != led {
            return Err("Must follow suit");
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lead_suit_wins_over_offsuit() {
        let plays = vec![
            TrickPlay {
                player_id: "p1".into(),
                card: Card::new(Suit::Hearts, 10),
            },
            TrickPlay {
                player_id: "p2".into(),
                card: Card::new(Suit::Clubs, 14),
            },
        ];
        let winner = resolve_trick(&plays, Suit::Hearts, None);
        assert_eq!(winner, Some(0));
    }

    #[test]
    fn test_trump_beats_lead_suit() {
        let plays = vec![
            TrickPlay {
                player_id: "p1".into(),
                card: Card::new(Suit::Hearts, 14),
            },
            TrickPlay {
                player_id: "p2".into(),
                card: Card::new(Suit::Spades, 2),
            },
        ];
        let winner = resolve_trick(&plays, Suit::Hearts, Some(Suit::Spades));
        assert_eq!(winner, Some(1));
    }

    #[test]
    fn test_follow_suit_validation() {
        let hand = vec![Card::new(Suit::Hearts, 10), Card::new(Suit::Clubs, 5)];
        assert!(validate_follow_suit(&hand, Card::new(Suit::Clubs, 5), Some(Suit::Hearts)).is_err());
        assert!(validate_follow_suit(&hand, Card::new(Suit::Hearts, 10), Some(Suit::Hearts)).is_ok());
    }
}
