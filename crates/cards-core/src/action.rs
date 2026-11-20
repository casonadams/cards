use serde::{Deserialize, Serialize};

use crate::card::{Card, Seat};
use crate::game::GameKind;
use crate::trick::Play;

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Action {
    Bid(u8),
    Play(Card),
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct Bid {
    pub seat: Seat,
    pub amount: u8,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum Event {
    RoundStarted { round: usize, dealer: Seat },
    BidPlaced { seat: Seat, amount: u8 },
    BiddingEnded,
    CardPlayed { seat: Seat, card: Card },
    TrickWon { winner: Seat, cards: Vec<Play> },
    RoundEnded { scores: Vec<i32>, totals: Vec<i32> },
    GameEnded { totals: Vec<i32> },
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum Rejection {
    UnknownSeat,
    NotYourTurn,
    WrongPhase,
    BidOutOfRange { max: u8 },
    HookBid { forbidden: u8 },
    CardNotInHand,
    MustFollowSuit { led: crate::card::Suit },
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum SetupError {
    UnsupportedSeatCount { kind: GameKind, seats: usize },
}
