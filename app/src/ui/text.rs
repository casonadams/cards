use cards_core::{Card, Rejection, Suit};
use cards_net::Refusal;

use crate::session::Status;

pub fn rejection(rejection: Rejection) -> String {
    match rejection {
        Rejection::UnknownSeat => "You are not seated at this table.".into(),
        Rejection::NotYourTurn => "Wait for your turn.".into(),
        Rejection::WrongPhase => "That move is not possible right now.".into(),
        Rejection::BidOutOfRange { max } => format!("Bid between 0 and {max}."),
        Rejection::HookBid { forbidden } => {
            format!(
                "As dealer you cannot bid {forbidden}: the bids would add up to the cards dealt."
            )
        }
        Rejection::CardNotInHand => "That card is not in your hand.".into(),
        Rejection::MustFollowSuit { led } => format!("You must follow {}.", suit_name(led)),
    }
}

pub fn refusal(refusal: Refusal) -> &'static str {
    match refusal {
        Refusal::WrongCode => "That code does not match this table.",
        Refusal::TableFull => "The table is full.",
        Refusal::GameInProgress => "That game has already started.",
        Refusal::InvalidName => "Enter a name of 1 to 20 characters.",
        Refusal::Removed => "The host removed you from this table.",
    }
}

pub fn status(status: &Status) -> Option<String> {
    match status {
        Status::Idle | Status::Online => None,
        Status::Connecting => Some("Connecting...".into()),
        Status::HostAway { attempt } => Some(format!(
            "The host is away. The game is paused until they return (retry {attempt})."
        )),
        Status::Refused(r) => Some(refusal(*r).into()),
        Status::Closed => Some("The host ended this table.".into()),
        Status::Failed(message) => Some(message.clone()),
    }
}

pub fn suit_name(suit: Suit) -> &'static str {
    match suit {
        Suit::Clubs => "clubs",
        Suit::Diamonds => "diamonds",
        Suit::Hearts => "hearts",
        Suit::Spades => "spades",
    }
}

pub fn suit_symbol(suit: Suit) -> &'static str {
    match suit {
        Suit::Clubs => "\u{2663}",
        Suit::Diamonds => "\u{2666}",
        Suit::Hearts => "\u{2665}",
        Suit::Spades => "\u{2660}",
    }
}

pub fn rank_glyph(rank: u8) -> String {
    match rank {
        11 => "J".into(),
        12 => "Q".into(),
        13 => "K".into(),
        14 => "A".into(),
        n => n.to_string(),
    }
}

pub fn card_label(card: Card) -> String {
    let rank = match card.rank {
        11 => "Jack".into(),
        12 => "Queen".into(),
        13 => "King".into(),
        14 => "Ace".into(),
        n => n.to_string(),
    };
    format!("{rank} of {}", suit_name(card.suit))
}

/// The first word of a display name, kept whole for bots ("Bot Bob").
pub fn first_name(name: &str) -> &str {
    if name.starts_with("Bot ") {
        return name;
    }
    name.split_whitespace().next().unwrap_or(name)
}

/// "FL" initials from the first and last word.
pub fn initials(name: &str) -> String {
    let words: Vec<&str> = name.split_whitespace().collect();
    let pick = match words.as_slice() {
        [] => Vec::new(),
        [only] => vec![*only],
        [first, .., last] => vec![*first, *last],
    };
    pick.iter()
        .filter_map(|w| w.chars().next())
        .flat_map(char::to_uppercase)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initials_and_first_names_follow_the_seating_rules() {
        let cases = [
            ("John Doe", "JD", "John"),
            ("Cason Adams", "CA", "Cason"),
            ("Cher", "C", "Cher"),
            ("Mary Jo Smith", "MS", "Mary"),
            ("Bot Bob", "BB", "Bot Bob"),
        ];
        for (name, init, first) in cases {
            assert_eq!(initials(name), init, "{name}");
            assert_eq!(first_name(name), first, "{name}");
        }
    }
}
