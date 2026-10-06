use cards_engine::card::{Card, Suit};
use cards_engine::games::canadian_salad::CanadianSaladGame;
use cards_engine::games::oh_well::OhWellGame;
use wasm_bindgen::prelude::*;

fn parse_suit(s: &str) -> Result<Suit, JsError> {
    match s.to_lowercase().as_str() {
        "clubs" | "club" => Ok(Suit::Clubs),
        "diamonds" | "diamond" => Ok(Suit::Diamonds),
        "hearts" | "heart" => Ok(Suit::Hearts),
        "spades" | "spade" => Ok(Suit::Spades),
        _ => Err(JsError::new(&format!("Unknown suit: {s}"))),
    }
}

#[wasm_bindgen]
pub struct WasmOhWell(OhWellGame);

#[wasm_bindgen]
impl WasmOhWell {
    #[wasm_bindgen(constructor)]
    pub fn new(player_ids: Vec<String>, seed: u32) -> Result<WasmOhWell, JsError> {
        let game = OhWellGame::new(player_ids, seed).map_err(JsError::new)?;
        Ok(Self(game))
    }

    pub fn place_bid(&mut self, player_id: &str, bid: u8) -> Result<(), JsError> {
        self.0.place_bid(player_id, bid).map_err(JsError::new)
    }

    pub fn play_card(&mut self, player_id: &str, suit: &str, rank: u8) -> Result<(), JsError> {
        let suit = parse_suit(suit)?;
        let card = Card::new(suit, rank);
        self.0.play_card(player_id, card).map_err(JsError::new)
    }

    pub fn start_round(&mut self, round_index: usize) {
        self.0.start_round(round_index);
    }

    pub fn get_state(&self) -> Result<JsValue, JsError> {
        serde_wasm_bindgen::to_value(&self.0.round_state).map_err(|e| JsError::new(&e.to_string()))
    }

    pub fn get_hands(&self) -> Result<JsValue, JsError> {
        serde_wasm_bindgen::to_value(&self.0.hands).map_err(|e| JsError::new(&e.to_string()))
    }
}

#[wasm_bindgen]
pub struct WasmCanadianSalad(CanadianSaladGame);

#[wasm_bindgen]
impl WasmCanadianSalad {
    #[wasm_bindgen(constructor)]
    pub fn new(player_ids: Vec<String>, seed: u32) -> Result<WasmCanadianSalad, JsError> {
        let game = CanadianSaladGame::new(player_ids, seed).map_err(JsError::new)?;
        Ok(Self(game))
    }

    pub fn play_card(&mut self, player_id: &str, suit: &str, rank: u8) -> Result<(), JsError> {
        let suit = parse_suit(suit)?;
        let card = Card::new(suit, rank);
        self.0.play_card(player_id, card).map_err(JsError::new)
    }

    pub fn start_round(&mut self, round_index: usize) {
        self.0.start_round(round_index);
    }

    pub fn get_state(&self) -> Result<JsValue, JsError> {
        serde_wasm_bindgen::to_value(&self.0.round_state).map_err(|e| JsError::new(&e.to_string()))
    }

    pub fn get_hands(&self) -> Result<JsValue, JsError> {
        serde_wasm_bindgen::to_value(&self.0.hands).map_err(|e| JsError::new(&e.to_string()))
    }
}
