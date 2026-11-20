use serde::{Deserialize, Serialize};

use crate::{canadian_salad, oh_well};

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum GameKind {
    OhWell,
    CanadianSalad,
}

impl GameKind {
    pub fn min_players(self) -> usize {
        3
    }

    pub fn max_players(self) -> usize {
        match self {
            GameKind::OhWell => 7,
            GameKind::CanadianSalad => 6,
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            GameKind::OhWell => "Oh Well",
            GameKind::CanadianSalad => "Canadian Salad",
        }
    }

    pub fn total_rounds(self, seats: usize) -> usize {
        match self {
            GameKind::OhWell => oh_well::rules::total_rounds(seats),
            GameKind::CanadianSalad => canadian_salad::rules::HAND_SEQUENCE.len(),
        }
    }
}
