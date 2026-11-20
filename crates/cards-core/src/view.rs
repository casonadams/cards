use serde::{Deserialize, Serialize};

use crate::Bid;
use crate::canadian_salad::rules as salad;
use crate::card::{Card, Seat, Suit, sort_hand};
use crate::game::GameKind;
use crate::oh_well::rules as oh_well;
use crate::table::{Phase, Table};
use crate::trick::{Play, Trick};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct SeatView {
    pub kind: GameKind,
    pub seat: Seat,
    pub seats: usize,
    pub phase: Phase,
    pub round: usize,
    pub total_rounds: usize,
    pub round_label: String,
    pub rules_text: String,
    pub hand: Vec<Card>,
    pub hand_sizes: Vec<usize>,
    pub cards_per_player: usize,
    pub trump_card: Option<Card>,
    pub trump_suit: Option<Suit>,
    pub hand_type: Option<salad::HandType>,
    pub dealer: Seat,
    pub first_actor: Seat,
    pub bids: Vec<Bid>,
    pub current_trick: Vec<Play>,
    pub tricks: Vec<Trick>,
    pub last_trick: Option<Trick>,
    pub tricks_taken: Vec<usize>,
    pub round_scores: Vec<Vec<i32>>,
    pub totals: Vec<i32>,
    pub actor: Option<Seat>,
    pub playable_cards: Vec<Card>,
    pub legal_bids: Vec<u8>,
    pub round_over: bool,
    pub game_over: bool,
}

impl SeatView {
    pub fn bid_of(&self, seat: Seat) -> Option<u8> {
        self.bids.iter().find(|b| b.seat == seat).map(|b| b.amount)
    }
}

impl Table {
    pub fn view(&self, seat: Seat) -> SeatView {
        let mut hand = self.hands.get(seat.index()).cloned().unwrap_or_default();
        sort_hand(&mut hand, self.trump_suit());
        let hand_type = match self.kind {
            GameKind::CanadianSalad => salad::HAND_SEQUENCE.get(self.round).copied(),
            GameKind::OhWell => None,
        };
        let (round_label, rules_text) = match hand_type {
            Some(h) => (h.label().to_string(), h.rules().to_string()),
            None => (
                format!("Round {}", self.round + 1),
                oh_well::RULES_TEXT.to_string(),
            ),
        };
        SeatView {
            kind: self.kind,
            seat,
            seats: self.seats,
            phase: self.phase,
            round: self.round,
            total_rounds: self.kind.total_rounds(self.seats),
            round_label,
            rules_text,
            hand,
            hand_sizes: self.hands.iter().map(Vec::len).collect(),
            cards_per_player: self.cards_per_player,
            trump_card: self.trump_card,
            trump_suit: self.trump_suit(),
            hand_type,
            dealer: self.dealer,
            first_actor: self.first_actor(),
            bids: self.bids.clone(),
            current_trick: self.current.clone(),
            tricks: self.tricks.clone(),
            last_trick: self.tricks.last().cloned(),
            tricks_taken: self.tricks_taken(),
            round_scores: self.round_scores.clone(),
            totals: self.totals(),
            actor: self.actor(),
            playable_cards: if self.actor() == Some(seat) {
                let mut cards = self.playable(seat);
                sort_hand(&mut cards, self.trump_suit());
                cards
            } else {
                Vec::new()
            },
            legal_bids: if self.actor() == Some(seat) {
                self.legal_bids()
            } else {
                Vec::new()
            },
            round_over: matches!(self.phase, Phase::RoundOver | Phase::GameOver),
            game_over: self.phase == Phase::GameOver,
        }
    }
}
