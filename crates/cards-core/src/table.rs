use serde::{Deserialize, Serialize};

use crate::action::{Action, Bid, Event, Rejection, SetupError};
use crate::canadian_salad::rules as salad;
use crate::card::{Card, Seat, Suit};
use crate::game::GameKind;
use crate::oh_well::rules as oh_well;
use crate::trick::{self, Play, Trick};

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Phase {
    Bidding,
    Playing,
    RoundOver,
    GameOver,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct Table {
    pub(crate) kind: GameKind,
    pub(crate) seats: usize,
    pub(crate) seed: u64,
    pub(crate) round: usize,
    pub(crate) dealer: Seat,
    pub(crate) phase: Phase,
    pub(crate) cards_per_player: usize,
    pub(crate) hands: Vec<Vec<Card>>,
    pub(crate) trump_card: Option<Card>,
    pub(crate) bids: Vec<Bid>,
    pub(crate) leader: Seat,
    pub(crate) current: Vec<Play>,
    pub(crate) tricks: Vec<Trick>,
    pub(crate) round_scores: Vec<Vec<i32>>,
}

impl Table {
    pub fn new(kind: GameKind, seats: usize, seed: u64) -> Result<Table, SetupError> {
        if seats < kind.min_players() || seats > kind.max_players() {
            return Err(SetupError::UnsupportedSeatCount { kind, seats });
        }
        let mut table = Table {
            kind,
            seats,
            seed,
            round: 0,
            dealer: Seat(0),
            phase: Phase::Playing,
            cards_per_player: 0,
            hands: Vec::new(),
            trump_card: None,
            bids: Vec::new(),
            leader: Seat(0),
            current: Vec::new(),
            tricks: Vec::new(),
            round_scores: Vec::new(),
        };
        table.deal_round();
        Ok(table)
    }

    fn deal_round(&mut self) {
        self.bids.clear();
        self.current.clear();
        self.tricks.clear();
        self.leader = self.first_actor();
        match self.kind {
            GameKind::OhWell => {
                let deal = oh_well::deal(self.seats, self.round, self.seed);
                self.cards_per_player = oh_well::cards_for_round(self.round, self.seats);
                self.hands = deal.hands;
                self.trump_card = deal.trump_card;
                self.phase = Phase::Bidding;
            }
            GameKind::CanadianSalad => {
                self.hands = salad::deal(self.seats, self.round, self.seed);
                self.cards_per_player = self.hands.first().map_or(0, Vec::len);
                self.trump_card = None;
                self.phase = Phase::Playing;
            }
        }
    }

    pub fn kind(&self) -> GameKind {
        self.kind
    }

    pub fn seats(&self) -> usize {
        self.seats
    }

    pub fn phase(&self) -> Phase {
        self.phase
    }

    pub fn round(&self) -> usize {
        self.round
    }

    pub fn dealer(&self) -> Seat {
        self.dealer
    }

    pub fn trump_suit(&self) -> Option<Suit> {
        self.trump_card.map(|c| c.suit)
    }

    pub fn totals(&self) -> Vec<i32> {
        let mut totals = vec![0; self.seats];
        for round in &self.round_scores {
            for (t, s) in totals.iter_mut().zip(round) {
                *t += s;
            }
        }
        totals
    }

    pub fn tricks_taken(&self) -> Vec<usize> {
        let mut taken = vec![0; self.seats];
        for trick in &self.tricks {
            taken[trick.winner.index()] += 1;
        }
        taken
    }

    pub fn actor(&self) -> Option<Seat> {
        let (start, offset) = match self.phase {
            Phase::Bidding => (self.first_actor(), self.bids.len()),
            Phase::Playing => (self.leader, self.current.len()),
            Phase::RoundOver | Phase::GameOver => return None,
        };
        Some(self.seat_after(start, offset))
    }

    pub(crate) fn first_actor(&self) -> Seat {
        self.seat_after(self.dealer, 1)
    }

    fn seat_after(&self, seat: Seat, steps: usize) -> Seat {
        Seat::from_index((seat.index() + steps) % self.seats)
    }

    fn max_bid(&self) -> u8 {
        u8::try_from(self.cards_per_player).unwrap_or(u8::MAX)
    }

    pub(crate) fn led_suit(&self) -> Option<Suit> {
        self.current.first().map(|p| p.card.suit)
    }

    pub(crate) fn hook(&self) -> Option<u8> {
        oh_well::hook_bid(&self.bids, self.seats, self.cards_per_player)
    }

    pub(crate) fn legal_bids(&self) -> Vec<u8> {
        if self.phase != Phase::Bidding {
            return Vec::new();
        }
        let hook = self.hook();
        (0..=self.max_bid()).filter(|b| Some(*b) != hook).collect()
    }

    pub(crate) fn playable(&self, seat: Seat) -> Vec<Card> {
        match (self.phase, self.hands.get(seat.index())) {
            (Phase::Playing, Some(hand)) => trick::legal_cards(hand, self.led_suit()),
            _ => Vec::new(),
        }
    }

    pub fn legal_actions(&self, seat: Seat) -> Vec<Action> {
        if self.actor() != Some(seat) {
            return Vec::new();
        }
        match self.phase {
            Phase::Bidding => self.legal_bids().into_iter().map(Action::Bid).collect(),
            _ => self.playable(seat).into_iter().map(Action::Play).collect(),
        }
    }

    pub fn apply(&mut self, seat: Seat, action: Action) -> Result<Vec<Event>, Rejection> {
        if seat.index() >= self.seats {
            return Err(Rejection::UnknownSeat);
        }
        match (self.phase, action) {
            (Phase::Bidding, Action::Bid(amount)) => self.bid(seat, amount),
            (Phase::Playing, Action::Play(card)) => self.play(seat, card),
            _ => Err(Rejection::WrongPhase),
        }
    }

    fn bid(&mut self, seat: Seat, amount: u8) -> Result<Vec<Event>, Rejection> {
        if self.actor() != Some(seat) {
            return Err(Rejection::NotYourTurn);
        }
        let max = self.max_bid();
        if amount > max {
            return Err(Rejection::BidOutOfRange { max });
        }
        if let Some(forbidden) = self.hook().filter(|h| *h == amount) {
            return Err(Rejection::HookBid { forbidden });
        }
        self.bids.push(Bid { seat, amount });
        let mut events = vec![Event::BidPlaced { seat, amount }];
        if self.bids.len() == self.seats {
            self.phase = Phase::Playing;
            events.push(Event::BiddingEnded);
        }
        Ok(events)
    }

    fn play(&mut self, seat: Seat, card: Card) -> Result<Vec<Event>, Rejection> {
        if self.actor() != Some(seat) {
            return Err(Rejection::NotYourTurn);
        }
        trick::check_play(&self.hands[seat.index()], card, self.led_suit())?;
        let hand = &mut self.hands[seat.index()];
        crate::card::remove_card(hand, card);
        self.current.push(Play { seat, card });
        let mut events = vec![Event::CardPlayed { seat, card }];
        if self.current.len() == self.seats {
            self.finish_trick(&mut events);
        }
        Ok(events)
    }

    fn finish_trick(&mut self, events: &mut Vec<Event>) {
        let plays = std::mem::take(&mut self.current);
        let winner = trick::winner(&plays, self.trump_suit()).map_or(self.leader, |p| p.seat);
        events.push(Event::TrickWon {
            winner,
            cards: plays.clone(),
        });
        self.tricks.push(Trick { plays, winner });
        self.leader = winner;
        if self.tricks.len() == self.cards_per_player {
            self.finish_round(events);
        }
    }

    fn finish_round(&mut self, events: &mut Vec<Event>) {
        let scores = match self.kind {
            GameKind::OhWell => oh_well::score_round(&self.bids, &self.tricks_taken(), self.seats),
            GameKind::CanadianSalad => {
                salad::score_hand(salad::HAND_SEQUENCE[self.round], &self.tricks, self.seats)
            }
        };
        self.round_scores.push(scores.clone());
        events.push(Event::RoundEnded {
            scores,
            totals: self.totals(),
        });
        self.phase = Phase::RoundOver;
        if self.round + 1 >= self.kind.total_rounds(self.seats) {
            self.phase = Phase::GameOver;
            events.push(Event::GameEnded {
                totals: self.totals(),
            });
        }
    }

    pub fn start_next_round(&mut self) -> Result<Vec<Event>, Rejection> {
        if self.phase != Phase::RoundOver {
            return Err(Rejection::WrongPhase);
        }
        self.round += 1;
        self.dealer = self.seat_after(self.dealer, 1);
        self.deal_round();
        Ok(vec![Event::RoundStarted {
            round: self.round,
            dealer: self.dealer,
        }])
    }
}
