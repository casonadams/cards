use crate::card::{Card, SeededRng, Suit, create_deck};
use crate::trick::{TrickPlay, resolve_trick, validate_follow_suit};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CanadianHandType {
    NoTricks,
    NoHearts,
    NoQueens,
    NoKingSpades,
    NoLastTrick,
    Combination,
}

pub const HAND_SEQUENCE: [CanadianHandType; 6] = [
    CanadianHandType::NoTricks,
    CanadianHandType::NoHearts,
    CanadianHandType::NoQueens,
    CanadianHandType::NoKingSpades,
    CanadianHandType::NoLastTrick,
    CanadianHandType::Combination,
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CanadianPhase {
    Playing,
    RoundOver,
    GameOver,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanadianRoundState {
    pub round_index: usize,
    pub hand_type: CanadianHandType,
    pub cards_per_player: usize,
    pub dealer_index: usize,
    pub phase: CanadianPhase,
    pub current_turn_index: usize,
    pub current_trick: Vec<TrickPlay>,
    pub completed_tricks: Vec<Vec<TrickPlay>>,
    pub tricks_won: Vec<usize>,
    pub scores: Vec<i32>,
    pub cumulative_scores: Vec<i32>,
}

#[derive(Debug, Clone)]
pub struct CanadianSaladGame {
    pub player_ids: Vec<String>,
    pub seed: u32,
    pub current_round: usize,
    pub cumulative_scores: Vec<i32>,
    pub hands: Vec<Vec<Card>>,
    pub round_state: CanadianRoundState,
}

pub fn cards_to_remove(player_count: usize) -> Vec<Card> {
    match player_count {
        3 => vec![Card::new(Suit::Clubs, 2)],
        4 => vec![],
        5 => vec![Card::new(Suit::Clubs, 2), Card::new(Suit::Diamonds, 2)],
        6 => vec![
            Card::new(Suit::Clubs, 2),
            Card::new(Suit::Clubs, 3),
            Card::new(Suit::Diamonds, 2),
            Card::new(Suit::Diamonds, 3),
        ],
        _ => vec![],
    }
}

pub fn cards_per_player(player_count: usize) -> usize {
    match player_count {
        3 => 17,
        4 => 13,
        5 => 10,
        6 => 8,
        _ => 13,
    }
}

impl CanadianSaladGame {
    pub fn new(player_ids: Vec<String>, seed: u32) -> Result<Self, &'static str> {
        let n = player_ids.len();
        if !(3..=6).contains(&n) {
            return Err("Canadian Salad requires 3 to 6 players");
        }

        let mut game = Self {
            cumulative_scores: vec![0; n],
            player_ids,
            seed,
            current_round: 0,
            hands: Vec::new(),
            round_state: CanadianRoundState {
                round_index: 0,
                hand_type: CanadianHandType::NoTricks,
                cards_per_player: 0,
                dealer_index: 0,
                phase: CanadianPhase::Playing,
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
        let hand_type = HAND_SEQUENCE[round_index];
        let per_player = cards_per_player(n);
        let dealer_index = round_index % n;

        let to_remove = cards_to_remove(n);
        let base_deck: Vec<Card> = create_deck().into_iter().filter(|c| !to_remove.contains(c)).collect();

        let round_seed = self.seed.wrapping_add(round_index as u32);
        let mut rng = SeededRng::new(round_seed);
        let shuffled = rng.shuffle(&base_deck);

        let mut hands: Vec<Vec<Card>> = vec![Vec::with_capacity(per_player); n];
        let mut deal_idx = 0;
        for _ in 0..per_player {
            for hand in hands.iter_mut().take(n) {
                hand.push(shuffled[deal_idx]);
                deal_idx += 1;
            }
        }

        self.hands = hands;
        self.current_round = round_index;

        let first_player = (dealer_index + 1) % n;

        self.round_state = CanadianRoundState {
            round_index,
            hand_type,
            cards_per_player: per_player,
            dealer_index,
            phase: CanadianPhase::Playing,
            current_turn_index: first_player,
            current_trick: Vec::with_capacity(n),
            completed_tricks: Vec::new(),
            tricks_won: vec![0; n],
            scores: vec![0; n],
            cumulative_scores: self.cumulative_scores.clone(),
        };
    }

    pub fn play_card(&mut self, player_id: &str, card: Card) -> Result<(), &'static str> {
        if self.round_state.phase != CanadianPhase::Playing {
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
        let win_offset = resolve_trick(&self.round_state.current_trick, led_suit, None).unwrap();
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
        let last_winner_id = self.round_state.completed_tricks.last().and_then(|t| {
            let led_suit = t[0].card.suit;
            let offset = resolve_trick(t, led_suit, None)?;
            Some(t[offset].player_id.clone())
        });

        for (i, p_id) in self.player_ids.iter().enumerate().take(n) {
            let won_tricks: Vec<&Vec<TrickPlay>> = self
                .round_state
                .completed_tricks
                .iter()
                .filter(|t| {
                    let led = t[0].card.suit;
                    let off = resolve_trick(t, led, None).unwrap();
                    &t[off].player_id == p_id
                })
                .collect();

            let is_last = last_winner_id.as_deref() == Some(p_id.as_str());
            let score = score_player_hand(self.round_state.hand_type, &won_tricks, is_last);
            round_scores[i] = score;
            self.cumulative_scores[i] += score;
        }

        self.round_state.scores = round_scores;
        self.round_state.cumulative_scores = self.cumulative_scores.clone();

        let next_round = self.current_round + 1;
        if next_round >= HAND_SEQUENCE.len() {
            self.round_state.phase = CanadianPhase::GameOver;
        } else {
            self.round_state.phase = CanadianPhase::RoundOver;
        }
    }
}

fn score_player_hand(hand_type: CanadianHandType, won_tricks: &[&Vec<TrickPlay>], is_last_winner: bool) -> i32 {
    let trick_count = won_tricks.len() as i32;
    let hearts = won_tricks
        .iter()
        .flat_map(|t| t.iter())
        .filter(|p| p.card.suit == Suit::Hearts)
        .count() as i32;
    let queens = won_tricks
        .iter()
        .flat_map(|t| t.iter())
        .filter(|p| p.card.rank == 12)
        .count() as i32;
    let has_king_spades = won_tricks
        .iter()
        .flat_map(|t| t.iter())
        .any(|p| p.card.suit == Suit::Spades && p.card.rank == 13);
    let last_trick_pts = if is_last_winner { 100 } else { 0 };

    match hand_type {
        CanadianHandType::NoTricks => trick_count * 10,
        CanadianHandType::NoHearts => hearts * 10,
        CanadianHandType::NoQueens => queens * 25,
        CanadianHandType::NoKingSpades => {
            if has_king_spades {
                100
            } else {
                0
            }
        }
        CanadianHandType::NoLastTrick => last_trick_pts,
        CanadianHandType::Combination => {
            trick_count * 10 + hearts * 10 + queens * 25 + if has_king_spades { 100 } else { 0 } + last_trick_pts
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_canadian_salad_hand_sequence() {
        assert_eq!(HAND_SEQUENCE.len(), 6);
        assert_eq!(HAND_SEQUENCE[0], CanadianHandType::NoTricks);
        assert_eq!(HAND_SEQUENCE[5], CanadianHandType::Combination);
    }

    #[test]
    fn test_cards_removed_per_player_count() {
        assert_eq!(cards_to_remove(3).len(), 1);
        assert_eq!(cards_to_remove(4).len(), 0);
        assert_eq!(cards_to_remove(5).len(), 2);
        assert_eq!(cards_to_remove(6).len(), 4);
    }

    #[test]
    fn test_canadian_salad_gameplay() {
        let players = vec!["alice".into(), "bob".into(), "carol".into(), "dave".into()];
        let game = CanadianSaladGame::new(players, 999).unwrap();
        assert_eq!(game.round_state.phase, CanadianPhase::Playing);
        assert_eq!(game.round_state.current_turn_index, 1); // Left of dealer
        assert_eq!(game.hands[0].len(), 13);
    }

    #[test]
    fn test_score_player_hand_all_types() {
        let trick1 = vec![
            TrickPlay {
                player_id: "alice".into(),
                card: Card::new(Suit::Hearts, 12),
            },
            TrickPlay {
                player_id: "bob".into(),
                card: Card::new(Suit::Hearts, 2),
            },
        ];
        let trick2 = vec![
            TrickPlay {
                player_id: "alice".into(),
                card: Card::new(Suit::Spades, 13),
            },
            TrickPlay {
                player_id: "bob".into(),
                card: Card::new(Suit::Clubs, 4),
            },
        ];
        let won = vec![&trick1, &trick2];

        assert_eq!(score_player_hand(CanadianHandType::NoTricks, &won, false), 20);
        assert_eq!(score_player_hand(CanadianHandType::NoHearts, &won, false), 20);
        assert_eq!(score_player_hand(CanadianHandType::NoQueens, &won, false), 25);
        assert_eq!(score_player_hand(CanadianHandType::NoKingSpades, &won, false), 100);
        assert_eq!(score_player_hand(CanadianHandType::NoLastTrick, &won, true), 100);
        assert_eq!(score_player_hand(CanadianHandType::NoLastTrick, &won, false), 0);
        assert_eq!(score_player_hand(CanadianHandType::Combination, &won, true), 265);
    }
}
