use crate::card::{Card, SeededRng, Suit, create_deck};
use crate::trick::{TrickPlay, resolve_trick, validate_follow_suit};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OhWellPhase {
    Bidding,
    Playing,
    RoundOver,
    GameOver,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PlayerBid {
    pub player_id: String,
    pub bid: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OhWellRoundState {
    pub round_index: usize,
    pub total_rounds: usize,
    pub cards_per_player: usize,
    pub dealer_index: usize,
    pub trump_suit: Option<Suit>,
    pub trump_card: Option<Card>,
    pub phase: OhWellPhase,
    pub bids: Vec<PlayerBid>,
    pub current_turn_index: usize,
    pub current_trick: Vec<TrickPlay>,
    pub completed_tricks: Vec<Vec<TrickPlay>>,
    pub tricks_won: Vec<usize>,
    pub scores: Vec<i32>,
    pub cumulative_scores: Vec<i32>,
}

#[derive(Debug, Clone)]
pub struct OhWellGame {
    pub player_ids: Vec<String>,
    pub seed: u32,
    pub current_round: usize,
    pub cumulative_scores: Vec<i32>,
    pub hands: Vec<Vec<Card>>,
    pub trump_card: Option<Card>,
    pub round_state: OhWellRoundState,
}

pub fn max_cards_for_players(player_count: usize) -> usize {
    match player_count {
        3..=5 => 10,
        6 => 8,
        _ => 7,
    }
}

pub fn total_rounds_for_players(player_count: usize) -> usize {
    max_cards_for_players(player_count) * 2 - 1
}

pub fn cards_for_round(round: usize, player_count: usize) -> usize {
    let max = max_cards_for_players(player_count);
    let total = total_rounds_for_players(player_count);
    if round < max {
        max - round
    } else if round < total {
        round - max + 2
    } else {
        max
    }
}

pub fn is_hook_bid(bid: u8, existing_bids: &[PlayerBid], cards_per_player: usize) -> bool {
    let total_so_far: usize = existing_bids.iter().map(|b| b.bid as usize).sum();
    total_so_far + (bid as usize) == cards_per_player
}

impl OhWellGame {
    pub fn new(player_ids: Vec<String>, seed: u32) -> Result<Self, &'static str> {
        let n = player_ids.len();
        if !(3..=7).contains(&n) {
            return Err("Oh Well requires 3 to 7 players");
        }
        let mut game = Self {
            cumulative_scores: vec![0; n],
            player_ids,
            seed,
            current_round: 0,
            hands: Vec::new(),
            trump_card: None,
            round_state: OhWellRoundState {
                round_index: 0,
                total_rounds: 0,
                cards_per_player: 0,
                dealer_index: 0,
                trump_suit: None,
                trump_card: None,
                phase: OhWellPhase::Bidding,
                bids: Vec::new(),
                current_turn_index: 0,
                current_trick: Vec::new(),
                completed_tricks: Vec::new(),
                tricks_won: vec![0; n],
                scores: vec![0; n],
                cumulative_scores: vec![0; n],
            },
        };
        game.start_round(0);
        Ok(game)
    }

    pub fn start_round(&mut self, round_index: usize) {
        let n = self.player_ids.len();
        let total_rounds = total_rounds_for_players(n);
        let cards_per_player = cards_for_round(round_index, n);
        let dealer_index = round_index % n;

        let round_seed = self.seed.wrapping_add(round_index as u32);
        let mut rng = SeededRng::new(round_seed);
        let shuffled = rng.shuffle(&create_deck());

        let mut hands: Vec<Vec<Card>> = vec![Vec::with_capacity(cards_per_player); n];
        let mut deal_idx = 0;
        for _ in 0..cards_per_player {
            for hand in hands.iter_mut().take(n) {
                hand.push(shuffled[deal_idx]);
                deal_idx += 1;
            }
        }

        let trump_card = if deal_idx < shuffled.len() {
            Some(shuffled[deal_idx])
        } else {
            None
        };
        let trump_suit = trump_card.map(|c| c.suit);

        self.hands = hands;
        self.trump_card = trump_card;
        self.current_round = round_index;

        let first_bidder = (dealer_index + 1) % n;

        self.round_state = OhWellRoundState {
            round_index,
            total_rounds,
            cards_per_player,
            dealer_index,
            trump_suit,
            trump_card,
            phase: OhWellPhase::Bidding,
            bids: Vec::with_capacity(n),
            current_turn_index: first_bidder,
            current_trick: Vec::with_capacity(n),
            completed_tricks: Vec::new(),
            tricks_won: vec![0; n],
            scores: vec![0; n],
            cumulative_scores: self.cumulative_scores.clone(),
        };
    }

    pub fn place_bid(&mut self, player_id: &str, bid: u8) -> Result<(), &'static str> {
        if self.round_state.phase != OhWellPhase::Bidding {
            return Err("Not in bidding phase");
        }
        let expected_id = &self.player_ids[self.round_state.current_turn_index];
        if player_id != expected_id {
            return Err("Not player's turn to bid");
        }

        let n = self.player_ids.len();
        let is_dealer = self.round_state.current_turn_index == self.round_state.dealer_index;
        if is_dealer && is_hook_bid(bid, &self.round_state.bids, self.round_state.cards_per_player) {
            return Err("Dealer cannot bid hook value");
        }

        self.round_state.bids.push(PlayerBid {
            player_id: player_id.to_string(),
            bid,
        });

        if self.round_state.bids.len() == n {
            self.round_state.phase = OhWellPhase::Playing;
            self.round_state.current_turn_index = (self.round_state.dealer_index + 1) % n;
        } else {
            self.round_state.current_turn_index = (self.round_state.current_turn_index + 1) % n;
        }

        Ok(())
    }

    pub fn play_card(&mut self, player_id: &str, card: Card) -> Result<(), &'static str> {
        if self.round_state.phase != OhWellPhase::Playing {
            return Err("Not in playing phase");
        }
        let p_idx = self.round_state.current_turn_index;
        if self.player_ids[p_idx] != player_id {
            return Err("Not player's turn to play");
        }

        let led_suit = self.round_state.current_trick.first().map(|p| p.card.suit);
        validate_follow_suit(&self.hands[p_idx], card, led_suit)?;

        let card_pos = self.hands[p_idx].iter().position(|c| *c == card).unwrap();
        self.hands[p_idx].remove(card_pos);

        self.round_state.current_trick.push(TrickPlay {
            player_id: player_id.to_string(),
            card,
        });

        let n = self.player_ids.len();
        if self.round_state.current_trick.len() == n {
            self.resolve_current_trick();
        } else {
            self.round_state.current_turn_index = (p_idx + 1) % n;
        }

        Ok(())
    }

    fn resolve_current_trick(&mut self) {
        let led_suit = self.round_state.current_trick[0].card.suit;
        let win_offset = resolve_trick(&self.round_state.current_trick, led_suit, self.round_state.trump_suit).unwrap();
        let winner_id = &self.round_state.current_trick[win_offset].player_id;
        let winner_idx = self.player_ids.iter().position(|id| id == winner_id).unwrap();

        self.round_state.tricks_won[winner_idx] += 1;
        self.round_state.current_turn_index = winner_idx;

        let trick = std::mem::replace(
            &mut self.round_state.current_trick,
            Vec::with_capacity(self.player_ids.len()),
        );
        self.round_state.completed_tricks.push(trick);

        if self.round_state.completed_tricks.len() == self.round_state.cards_per_player {
            self.finish_round();
        }
    }

    fn finish_round(&mut self) {
        let n = self.player_ids.len();
        let mut round_scores = vec![0; n];

        for (i, p_id) in self.player_ids.iter().enumerate().take(n) {
            let bid = self
                .round_state
                .bids
                .iter()
                .find(|b| &b.player_id == p_id)
                .map(|b| b.bid as usize)
                .unwrap_or(0);

            let won = self.round_state.tricks_won[i];
            let score = if won == bid { 10 + (bid as i32) } else { 0 };
            round_scores[i] = score;
            self.cumulative_scores[i] += score;
        }

        self.round_state.scores = round_scores;
        self.round_state.cumulative_scores = self.cumulative_scores.clone();

        let next_round = self.current_round + 1;
        if next_round >= self.round_state.total_rounds {
            self.round_state.phase = OhWellPhase::GameOver;
        } else {
            self.round_state.phase = OhWellPhase::RoundOver;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_oh_well_round_schedule() {
        assert_eq!(max_cards_for_players(4), 10);
        assert_eq!(total_rounds_for_players(4), 19);
        assert_eq!(cards_for_round(0, 4), 10);
        assert_eq!(cards_for_round(9, 4), 1);
        assert_eq!(cards_for_round(10, 4), 2);
        assert_eq!(cards_for_round(18, 4), 10);
    }

    #[test]
    fn test_hook_rule() {
        let bids = vec![
            PlayerBid {
                player_id: "p1".into(),
                bid: 3,
            },
            PlayerBid {
                player_id: "p2".into(),
                bid: 2,
            },
        ];
        assert!(is_hook_bid(5, &bids, 10));
        assert!(!is_hook_bid(4, &bids, 10));
    }

    #[test]
    fn test_oh_well_gameplay_flow() {
        let players = vec!["alice".into(), "bob".into(), "carol".into(), "dave".into()];
        let mut game = OhWellGame::new(players, 42).unwrap();
        assert_eq!(game.round_state.phase, OhWellPhase::Bidding);
        assert_eq!(game.round_state.current_turn_index, 1); // Left of dealer (0)

        assert!(game.place_bid("bob", 2).is_ok());
        assert!(game.place_bid("carol", 3).is_ok());
        assert!(game.place_bid("dave", 1).is_ok());

        // Alice is dealer, cards_per_player = 10. Existing = 6. 10 - 6 = 4 is hook!
        assert!(game.place_bid("alice", 4).is_err());
        assert!(game.place_bid("alice", 3).is_ok());

        assert_eq!(game.round_state.phase, OhWellPhase::Playing);
        assert_eq!(game.round_state.current_turn_index, 1); // Bob leads
    }
}
